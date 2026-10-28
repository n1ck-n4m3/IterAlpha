import type {Bot, BotStats, BotView, Config, Level, Reason, Snapshot, Trade} from './types.ts';
import {evaluateStrategy} from './strategy.ts';

export const EXECUTION = {fee: 0.001, slippage: 0.0005, maxSpread: 0.0035, maxSnapshotAge: 15_000, maxGap: 60_000, maxDrawdown: 0.05} as const;
export function publicBot(bot: Bot): BotView {const {owner: _owner, ...view} = bot; return {...view,dataIntegrity:bot.config.feedMode==='browser'?'browser-provided':'server-observed',rankEligible:false};}
export function stats(bot: Bot | BotView, mark = bot.lastMark): BotStats {
  const equity = bot.cash + bot.quantity * mark * (1 - EXECUTION.slippage) * (1 - EXECUTION.fee);
  return {equity, netPnl: equity - bot.config.initialCash, returnPercent: (equity / bot.config.initialCash - 1) * 100,
    unrealizedPnl: bot.quantity ? bot.quantity * mark * (1 - EXECUTION.slippage) * (1 - EXECUTION.fee) - bot.entryCost : 0,
    winRate: bot.closedTrades ? bot.wins / bot.closedTrades * 100 : null, closedTrades: bot.closedTrades,
    realizedPnl: bot.realizedPnl, fees: bot.fees, maxDrawdown: bot.maxDrawdown * 100};
}
export function createBot(id: string, owner: string, config: Config, now: number): Bot {
  return {id, owner, version: 0, status: 'running', config, cash: config.initialCash, quantity: 0, entryCost: 0, entryPrice: 0, entryTime: 0,
    stop: null, target: null, lastBar: 0, lastTick: now, lastMark: 0, peakEquity: config.initialCash, maxDrawdown: 0,
    fees: 0, realizedPnl: 0, closedTrades: 0, wins: 0, losses: 0, trades: [], events: [{time: now, reason: 'started', action: 'resume'}], signal: null, createdAt: now, updatedAt: now};
}
export function snapshotUsable(snapshot: Snapshot, now: number) {
  return snapshot.mode === 'live' && Number.isFinite(snapshot.quoteTime) && snapshot.quoteTime <= now + 5000 && now - snapshot.quoteTime <= EXECUTION.maxSnapshotAge &&
    snapshot.fetchedAt <= now + 5000 && now - snapshot.fetchedAt <= EXECUTION.maxSnapshotAge && snapshot.bid > 0 && snapshot.ask >= snapshot.bid &&
    snapshot.bids.length > 0 && snapshot.asks.length > 0 && snapshot.bids.every(l => Number.isFinite(l.price) && Number.isFinite(l.quantity) && l.price > 0 && l.quantity > 0) &&
    snapshot.asks.every(l => Number.isFinite(l.price) && Number.isFinite(l.quantity) && l.price > 0 && l.quantity > 0);
}
function record(bot: Bot, reason: Reason, action: 'buy' | 'sell' | 'hold' | 'pause' | 'resume', now: number) {
  if (bot.events.at(-1)?.reason === reason && bot.events.at(-1)?.action === action && action === 'hold') return;
  bot.events = [...bot.events, {time: now, reason, action}].slice(-100);
}
export function pauseBot(previous: Bot, now: number, reason: Reason = 'paused'): Bot {
  const bot = structuredClone(previous); bot.status = 'paused'; bot.trace = [{stage: 'market', status: reason === 'stale' || reason === 'feed-unavailable' || reason === 'gap' ? 'blocked' : 'passed', reason}, {stage: 'execution', status: 'waiting', reason}]; bot.version++; bot.updatedAt = now; record(bot, reason, 'pause', now); return bot;
}
function depthPrice(levels: Level[], quantity: number): number | null {
  let remaining = quantity, notional = 0;
  for (const level of levels) {const take = Math.min(remaining, level.quantity); notional += take * level.price; remaining -= take; if (remaining <= quantity * 1e-10) return notional / quantity;}
  return null;
}
export function roundQuantity(value: number, step: number): number {return Number((Math.floor((value + step * 1e-8) / step) * step).toPrecision(14));}
function fill(bot: Bot, snapshot: Snapshot, side: 'buy' | 'sell', reason: Reason, now: number): boolean {
  const market = bot.config.market;
  const budget = bot.cash * bot.config.allocationPercent / 100;
  // A conservative price cap avoids spending more than the preset allocation.
  const worstAsk = snapshot.asks.at(-1)!.price * (1 + EXECUTION.slippage);
  const quantity = side === 'buy' ? roundQuantity(budget / (worstAsk * (1 + EXECUTION.fee)), market.quantityStep) : bot.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity < market.minQuantity || quantity > market.maxQuantity) {bot.trace?.push({stage: 'risk', status: 'blocked', reason: 'small-order'}); record(bot, 'small-order', 'hold', now); return false;}
  const depth = depthPrice(side === 'buy' ? snapshot.asks : snapshot.bids, quantity);
  if (depth === null) {bot.trace?.push({stage: 'risk', status: 'blocked', reason: 'liquidity'}); record(bot, 'liquidity', 'hold', now); return false;}
  const price = depth * (side === 'buy' ? 1 + EXECUTION.slippage : 1 - EXECUTION.slippage);
  const notional = quantity * price, fee = notional * EXECUTION.fee;
  if (notional < market.minNotional || (side === 'buy' && notional + fee > bot.cash + 1e-8)) {bot.trace?.push({stage: 'risk', status: 'blocked', reason: 'small-order'}); record(bot, 'small-order', 'hold', now); return false;}
  bot.trace?.push({stage: 'risk', status: 'passed'}, {stage: 'execution', status: 'filled', reason});
  let netPnl: number | null = null;
  if (side === 'buy') {
    bot.cash -= notional + fee; bot.quantity = quantity; bot.entryCost = notional + fee; bot.entryPrice = price; bot.entryTime = now;
    bot.stop = price * (1 - bot.config.stopPercent / 100); bot.target = price * (1 + bot.config.targetPercent / 100);
  } else {
    netPnl = notional - fee - bot.entryCost; bot.cash += notional - fee; bot.quantity = 0; bot.entryCost = 0; bot.entryPrice = 0; bot.entryTime = 0; bot.stop = null; bot.target = null;
    bot.realizedPnl += netPnl; bot.closedTrades++; if (netPnl > 1e-8) bot.wins++; else if (netPnl < -1e-8) bot.losses++;
  }
  bot.fees += fee;
  const trade: Trade = {id: `${bot.id}:${bot.version}:${side}`, side, time: now, quantity, price, fee, notional, reason, netPnl};
  bot.trades = [...bot.trades, trade].slice(-500); record(bot, reason, side, now); return true;
}
export function advanceBot(previous: Bot, snapshot: Snapshot, now: number, command: 'tick' | 'resume' | 'close' = 'tick'): Bot {
  if (snapshot.market.id !== previous.config.market.id || snapshot.interval !== previous.config.interval) throw new Error('The snapshot does not match this spider.');
  if (command === 'tick' && (previous.status !== 'running' || now - previous.lastTick < 4000)) return previous;
  if (!snapshotUsable(snapshot, now)) return pauseBot(previous, now, 'stale');
  if (command === 'tick' && now - previous.lastTick > EXECUTION.maxGap) return pauseBot(previous, now, 'gap');
  const bot = structuredClone(previous); bot.version++; bot.updatedAt = now; bot.lastTick = now; bot.lastMark = snapshot.bid; bot.trace = [{stage: 'market', status: 'passed'}];
  if (command === 'resume') {bot.status = 'running'; record(bot, 'resumed', 'resume', now);}
  if (command === 'close') {
    if (bot.quantity) fill(bot, snapshot, 'sell', 'manual-close', now);
    bot.status = 'paused';
  } else {
    const equity = stats(bot).equity; bot.peakEquity = Math.max(bot.peakEquity, equity);
    bot.maxDrawdown = Math.max(bot.maxDrawdown, 1 - equity / bot.peakEquity);
    let exit: Reason | null = null;
    if (bot.quantity) {
      if (snapshot.bid <= bot.stop!) exit = 'stop';
      else if (snapshot.bid >= bot.target!) exit = 'target';
      else if (now - bot.entryTime >= bot.config.interval * 12_000) exit = 'timeout';
    }
    if (bot.maxDrawdown >= EXECUTION.maxDrawdown) {
      if (bot.quantity) fill(bot, snapshot, 'sell', 'drawdown', now);
      bot.status = 'paused'; record(bot, 'drawdown', 'pause', now);
    } else if (exit) {
      fill(bot, snapshot, 'sell', exit, now);
      bot.lastBar = Math.max(bot.lastBar, Math.floor(now / (bot.config.interval * 1000)) * bot.config.interval - bot.config.interval);
    } else {
      const signal = evaluateStrategy(bot.config.strategy, snapshot.candles, bot.config.interval, now, bot.quantity > 0); bot.signal = signal; bot.trace.push({stage: 'signal', status: signal.action === 'hold' ? 'waiting' : 'passed', reason: signal.reason});
      if (signal.bar > bot.lastBar) {
        bot.lastBar = signal.bar;
        if (signal.action === 'buy' && (snapshot.ask / snapshot.bid - 1) > EXECUTION.maxSpread) {bot.trace.push({stage: 'risk', status: 'blocked', reason: 'spread'}); record(bot, 'spread', 'hold', now);}
        else if (signal.action === 'buy' && !bot.quantity) fill(bot, snapshot, 'buy', signal.reason, now);
        else if (signal.action === 'sell' && bot.quantity) fill(bot, snapshot, 'sell', signal.reason, now);
        else record(bot, signal.reason, 'hold', now);
      }
    }
  }
  if (!bot.trace.some(t => t.stage === 'signal')) bot.trace.splice(1, 0, {stage: 'signal', status: command === 'close' ? 'waiting' : 'passed', reason: bot.events.at(-1)?.reason});
  if (!bot.trace.some(t => t.stage === 'risk')) bot.trace.push({stage: 'risk', status: 'waiting'});
  if (!bot.trace.some(t => t.stage === 'execution')) bot.trace.push({stage: 'execution', status: 'waiting', reason: bot.events.at(-1)?.reason});
  bot.trace.sort((a, b) => ['market','signal','risk','execution'].indexOf(a.stage) - ['market','signal','risk','execution'].indexOf(b.stage));
  const ending = stats(bot).equity; bot.peakEquity = Math.max(bot.peakEquity, ending); bot.maxDrawdown = Math.max(bot.maxDrawdown, 1 - ending / bot.peakEquity);
  return bot;
}
