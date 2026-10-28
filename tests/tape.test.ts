import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceBot, createBot, pauseBot, stats} from '../lib/spider/engine.ts';
import {evaluateTape, observeTape} from '../lib/spider/tape.ts';
import {executionCosts, roundTripCostBps} from '../lib/spider/costs.ts';
import type {Config, Snapshot, TapePoint} from '../lib/spider/types.ts';

const now = 1_790_000_000_000;
const market = {id: 'binance:BTCUSDT', venue: 'binance' as const, symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', quantityStep: .001, minQuantity: .001, maxQuantity: 1e6, minNotional: 5};
const config: Config = {market, strategy: 'tape', interval: 60, initialCash: 10000, allocationPercent: 20, stopPercent: .3, targetPercent: .6,
  feeBps: 10, slippageBps: 5, evaluationSeconds: 5, cooldownSeconds: 15};
function snapshot(time: number, price = 100, pressure = 5): Snapshot {
  const end = Math.floor(time / 60000) * 60 - 60;
  return {market, interval: 60, candles: Array.from({length: 80}, (_, i) => ({time: end - (79 - i) * 60, open: 99 + i * .01, high: 100 + i * .01, low: 98 + i * .01, close: 99.5 + i * .01, volume: 1000})),
    bids: [{price, quantity: pressure * 1000}], asks: [{price: price * 1.0001, quantity: 1000}], price, bid: price, ask: price * 1.0001, quoteTime: time, fetchedAt: time,
    change24h: null, mode: 'live', source: 'Binance Spot public market data'};
}
function observations(step = .1, feeBps = 10) {
  let points: TapePoint[] = [];
  for (let i = 0; i <= 6; i++) points = observeTape(points, snapshot(now + i * 5000, 100 + i * step), now + i * 5000);
  const quote = snapshot(now + 30000, 100 + 6 * step);
  return {points, ...evaluateTape({...config, feeBps}, points, quote, now + 30000, false)};
}
test('tape requires a genuine observation window and cannot warm up from repeated cached quotes', () => {
  const quote = snapshot(now); const points = observeTape([], quote, now);
  const repeated = observeTape(points, {...quote, fetchedAt: now + 5000}, now + 5000);
  assert.equal(repeated.length, 1);
  assert.equal(evaluateTape(config, repeated, quote, now + 5000, false).signal.reason, 'tape-warming');
  assert.equal(observeTape(points, snapshot(now + 20000), now + 20000).length, 1);
  assert.equal(observations().reading.ready, true);
});
test('sampled momentum is checked against costs and pressure, not treated as future EV', () => {
  assert.equal(observations(.1).signal.action, 'buy');
  const expensive = observations(.1, 60); assert.equal(expensive.signal.action, 'hold'); assert.equal(expensive.signal.reason, 'cost-gate');
  const bot = createBot('expensive', 'owner', {...config, feeBps: 60}, now); bot.tape = expensive.points.slice(0, -1);
  const skipped = advanceBot(bot, snapshot(now + 30000, 100.6), now + 30000);
  assert.equal(skipped.trades.length, 0); assert(skipped.trace!.some(step => step.stage === 'risk' && step.status === 'blocked' && step.reason === 'cost-gate'));
  const small = observations(.005); assert.equal(small.signal.reason, 'cost-gate');
  const flat = observations(0); assert.equal(flat.signal.action, 'hold');
  const fast = observations(.1); const sellPressure = snapshot(now + 30000, 100.6, .01);
  assert.equal(evaluateTape(config, fast.points, sellPressure, now + 30000, false).signal.action, 'hold');
});
test('network jitter retains a real historical reference instead of repeating warm-up', () => {
  let points: TapePoint[] = [];
  for (let i = 0; i <= 6; i++) points = observeTape(points, snapshot(now + i * 6000, 100 + i * .1), now + i * 6000);
  const result = evaluateTape(config, points, snapshot(now + 36000, 100.6), now + 36000, false);
  assert.equal(result.reading.ready, true); assert.equal(result.reading.windowSeconds, 30);
  const last = now + 43000; points = observeTape(points, snapshot(last, 100.7), last);
  const shifted = evaluateTape(config, points, snapshot(last, 100.7), last, false);
  assert.equal(shifted.reading.ready, true); assert.equal(shifted.reading.windowSeconds, 31);
});
test('five-second checks can open inside a candle and persist the actual decision and equity path', () => {
  let bot = createBot('tape', 'owner', config, now);
  for (let i = 1; i <= 7; i++) bot = advanceBot(bot, snapshot(now + i * 5000, 100 + i * .1), now + i * 5000);
  assert.equal(bot.evaluationCount, 7); assert.equal(bot.cycleCount, 7); assert.equal(bot.cycles!.length, 7);
  assert.equal(bot.trades.length, 1); assert.equal(bot.trades[0].reason, 'tape-entry');
  assert.equal(bot.lastBar, 0); assert.equal(bot.cycles!.at(-1)!.action, 'buy');
  assert.equal(bot.cycles!.at(-1)!.equity, stats(bot).equity);
  const duplicate = advanceBot(bot, snapshot(now + 36000), now + 36000); assert.equal(duplicate, bot);
});
test('protective exits bypass the discretionary cooldown and slower strategy cadence', () => {
  let bot = createBot('guard', 'owner', {...config, cooldownSeconds: 60}, now);
  for (let i = 1; i <= 7; i++) bot = advanceBot(bot, snapshot(now + i * 5000, 100 + i * .1), now + i * 5000);
  assert(bot.quantity > 0);
  const slower = {...bot, config: {...bot.config, evaluationSeconds: 30 as const}};
  const closed = advanceBot(slower, snapshot(now + 40000, 100), now + 40000);
  assert.equal(closed.quantity, 0); assert.equal(closed.trades.at(-1)!.reason, 'stop');
  assert.equal(closed.cycles!.at(-1)!.action, 'sell'); assert.equal(closed.evaluationCount, bot.evaluationCount);
});
test('a slower evaluation cadence still checks risk every fresh update', () => {
  let bot = createBot('slow', 'owner', {...config, evaluationSeconds: 15}, now);
  for (let i = 1; i <= 9; i++) bot = advanceBot(bot, snapshot(now + i * 5000, 100), now + i * 5000);
  assert.equal(bot.cycleCount, 9); assert.equal(bot.evaluationCount, 3);
  assert.equal(bot.cycles!.filter(cycle => cycle.strategyEvaluated).length, 3);
});
test('pause and resume discard stale tape; stale short-window quotes cannot create a fill', () => {
  let bot = createBot('pause', 'owner', config, now);
  bot = advanceBot(bot, snapshot(now + 5000), now + 5000);
  const paused = pauseBot(bot, now + 6000); assert.equal(paused.tape!.length, 0);
  const resumed = advanceBot(paused, snapshot(now + 100000), now + 100000, 'resume');
  assert.equal(resumed.tape!.length, 1); assert.equal(resumed.signal!.reason, 'tape-warming');
  const old = snapshot(now + 105000); old.quoteTime -= 8000;
  const stale = advanceBot(resumed, old, now + 105000); assert.equal(stale.status, 'paused'); assert.equal(stale.trades.length, 0);
});
test('configurable execution costs flow through fills, liquidation equity, and closed PnL', () => {
  const custom: Config = {...config, feeBps: 60, slippageBps: 20, strategy: 'trend'};
  const costs = executionCosts(custom), quote = snapshot(now + 5000);
  const bot = createBot('fees', 'owner', custom, now);
  // Exercise the close path with a position established at known cost.
  Object.assign(bot, {cash: 9000, quantity: 10, entryCost: 1000, entryPrice: 100, entryTime: now, lastMark: 100});
  const equity = 9000 + 10 * 100 * (1 - costs.slippage) * (1 - costs.fee);
  assert.equal(stats(bot).equity, equity);
  const closed = advanceBot(bot, quote, now + 5000, 'close');
  assert(Math.abs(closed.cash - equity) < 1e-8); assert(Math.abs(closed.realizedPnl - (equity - 10000)) < 1e-8);
  assert(roundTripCostBps(custom, 100, 100.01) > roundTripCostBps(config, 100, 100.01));
  const repeated = advanceBot(closed, quote, now + 5000, 'close');
  assert.equal(repeated.trades.length, closed.trades.length); assert.equal(repeated.cycles!.at(-1)!.action, 'hold');
});
