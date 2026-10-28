import {evaluateStrategy} from '../spider/strategy.ts';
import type {BarStrategy} from '../spider/types.ts';
import type {ResearchConfig, ResearchData} from './schema.ts';

export type ResearchPolicy = BarStrategy | 'cash' | 'buy-hold';
export type ResearchFill = {
  side: 'buy' | 'sell'; time: number; signalTime: number | null;
  price: number; quantity: number; fee: number; netPnl: number | null;
  reason: 'signal' | 'stop' | 'target' | 'timeout' | 'drawdown' | 'window-end' | 'baseline';
};
export type BacktestResult = {
  policy: ResearchPolicy; start: number; end: number; initialCash: number; finalCash: number;
  netPnl: number; returnPercent: number; maxDrawdownPercent: number; fees: number;
  closedTrades: number; winRate: number | null; meanNetPnlPerTrade: number | null;
  profitFactor: number | null; halted: boolean; peakEquity: number; rejectedEntries: number;
  fills: ResearchFill[]; equity: {time: number; value: number}[];
};

// OHLC research approximation, deliberately separate from live order-book paper fills.
// The signal observes at most 160 closed bars, matching the live feed window.
// Entry fills use the following open. No fill-bar high, low, close, or volume enters a signal.
export function backtest(data: ResearchData, config: ResearchConfig, policy: ResearchPolicy, start: number, end: number,
  riskState?: {peakEquity: number; halted: boolean}): BacktestResult {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 160 || end > data.candles.length || end <= start) throw new Error('Invalid research window.');
  const feeRate = config.feeBps / 10_000;
  const friction = (config.spreadBps / 2 + config.slippageBps) / 10_000;
  const {quantityStep, minQuantity, maxQuantity, minNotional} = data.rules;
  let cash = config.initialCash, quantity = 0, entryCost = 0, entryPrice = 0, entryBar = 0;
  let peak = Math.max(cash, riskState?.peakEquity ?? cash), drawdown = 0, fees = 0, rejectedEntries = 0, halted = riskState?.halted ?? false;
  const fills: ResearchFill[] = [], equity: {time: number; value: number}[] = [];
  const liquidationValue = (price: number) => cash + quantity * price * (1 - friction) * (1 - feeRate);
  const mark = (value: number) => {peak = Math.max(peak, value); drawdown = Math.max(drawdown, (peak - value) / peak * 100);
    if (drawdown >= config.maxDrawdownPercent && policy !== 'buy-hold') halted = true;};
  function sell(price: number, time: number, reason: ResearchFill['reason'], signalTime: number | null = null) {
    const actual = price * (1 - friction), fee = quantity * actual * feeRate;
    const proceeds = quantity * actual - fee;
    fills.push({side: 'sell', time, signalTime, price: actual, quantity, fee, netPnl: proceeds - entryCost, reason});
    cash += proceeds; fees += fee; quantity = 0; entryCost = 0;
    mark(cash);
    if (drawdown >= config.maxDrawdownPercent && policy !== 'buy-hold') halted = true;
  }
  function buy(price: number, index: number, signalTime: number | null) {
    const actual = price * (1 + friction), budget = cash * config.allocationPercent / 100;
    const units = Math.min(maxQuantity, budget / (actual * (1 + feeRate)));
    const candidate = Math.floor(units / quantityStep) * quantityStep;
    const cost = candidate * actual * (1 + feeRate);
    // Prior closed volume is a capacity proxy, not a reconstruction of historical L2 depth.
    const capacity = data.candles[index - 1].volume * config.maxPriorVolumePercent / 100;
    if (candidate < minQuantity || candidate * actual < minNotional || candidate > capacity || cost > cash || candidate <= 0) {rejectedEntries++; return;}
    quantity = candidate; entryCost = cost; entryPrice = actual; entryBar = index;
    const fee = quantity * actual * feeRate; fees += fee; cash -= cost;
    fills.push({side: 'buy', time: data.candles[index].time, signalTime, price: actual, quantity, fee, netPnl: null, reason: policy === 'buy-hold' ? 'baseline' : 'signal'});
    mark(liquidationValue(price));
  }
  for (let i = start; i < end; i++) {
    const bar = data.candles[i];
    const visible = data.candles.slice(Math.max(0, i - 160), i);
    const signal = policy === 'cash' || policy === 'buy-hold' ? null : evaluateStrategy(policy, visible, data.interval, bar.time * 1000, quantity > 0);
    mark(liquidationValue(bar.open));
    let closedAtOpen = false;
    if (quantity > 0 && policy !== 'buy-hold') {
      const stop = entryPrice * (1 - config.stopPercent / 100), target = entryPrice * (1 + config.targetPercent / 100);
      const openDrawdown = (peak - liquidationValue(bar.open)) / peak * 100 >= config.maxDrawdownPercent;
      const reason = openDrawdown ? 'drawdown' : bar.open <= stop ? 'stop' : bar.open >= target ? 'target' :
        signal?.action === 'sell' ? 'signal' : i - entryBar >= config.maxHoldBars ? 'timeout' : null;
      if (reason) {sell(bar.open, bar.time, reason, reason === 'signal' ? signal!.bar : null); closedAtOpen = true; if (reason === 'drawdown') halted = true;}
    }
    if (!halted && !closedAtOpen && quantity === 0 && (signal?.action === 'buy' || (policy === 'buy-hold' && i === start))) buy(bar.open, i, signal?.bar ?? null);
    if (quantity > 0 && policy !== 'buy-hold') {
      const stop = entryPrice * (1 - config.stopPercent / 100), target = entryPrice * (1 + config.targetPercent / 100);
      const drawdownPrice = (peak * (1 - config.maxDrawdownPercent / 100) - cash) / (quantity * (1 - friction) * (1 - feeRate));
      const downside = Math.max(stop, drawdownPrice);
      // Unknown intrabar path: when both barriers are touched, the adverse barrier wins.
      if (bar.low <= downside) {
        const reason = drawdownPrice >= stop ? 'drawdown' : 'stop';
        sell(Math.min(bar.open, downside), bar.time + data.interval, reason);
        if (reason === 'drawdown') halted = true;
      } else if (bar.high >= target) sell(target, bar.time + data.interval, 'target');
    }
    if (i === end - 1 && quantity > 0) sell(bar.close, bar.time + data.interval, 'window-end');
    const value = liquidationValue(bar.close); mark(value);
    equity.push({time: bar.time + data.interval, value});
  }
  const closed = fills.filter(fill => fill.side === 'sell'), wins = closed.filter(fill => fill.netPnl! > 0);
  const gains = wins.reduce((sum, fill) => sum + fill.netPnl!, 0), losses = -closed.filter(fill => fill.netPnl! < 0).reduce((sum, fill) => sum + fill.netPnl!, 0);
  return {policy, start: data.candles[start].time, end: data.candles[end - 1].time + data.interval,
    initialCash: config.initialCash, finalCash: cash, netPnl: cash - config.initialCash, returnPercent: (cash / config.initialCash - 1) * 100,
    maxDrawdownPercent: drawdown, fees, closedTrades: closed.length, winRate: closed.length ? wins.length / closed.length * 100 : null,
    meanNetPnlPerTrade: closed.length ? (cash - config.initialCash) / closed.length : null,
    profitFactor: losses > 0 ? gains / losses : null, halted, peakEquity: peak, rejectedEntries, fills, equity};
}
