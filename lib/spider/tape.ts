import {roundTripCostBps} from './costs.ts';
import type {Config, Signal, Snapshot, TapePoint, TapeReading} from './types.ts';

export function observeTape(previous: TapePoint[], snapshot: Snapshot, now: number): TapePoint[] {
  let points = previous.filter(point => now - point.time <= 120_000);
  const last = points.at(-1);
  if (last && now - last.time > 15_000) points = [];
  // A cached or older quote cannot manufacture another observation or a new signal.
  if (last && snapshot.quoteTime <= last.quoteTime) return points;
  return [...points, {time: now, quoteTime: snapshot.quoteTime, mid: (snapshot.bid + snapshot.ask) / 2}].slice(-120);
}

export function evaluateTape(config: Config, points: TapePoint[], snapshot: Snapshot, now: number, inPosition: boolean): {signal: Signal; reading: TapeReading} {
  const latest = points.at(-1);
  // Use the closest observation at least 30 seconds old. Network jitter must not
  // repeatedly erase a completed warm-up window or invent a missing price point.
  const reference = latest ? points.findLast(point => latest.time - point.time >= 30_000 && latest.time - point.time <= 45_000) : undefined;
  const window = latest ? points.filter(point => point.time >= (reference?.time ?? latest.time - 30_000)) : [];
  const fresh = !!latest && now - latest.time <= 7500 && now - snapshot.quoteTime <= 7500;
  const momentum = reference && latest ? (latest.mid / reference.mid - 1) * 10_000 : null;
  const bidDepth = snapshot.bids.slice(0, 10).reduce((sum, level) => sum + level.price * level.quantity, 0);
  const askDepth = snapshot.asks.slice(0, 10).reduce((sum, level) => sum + level.price * level.quantity, 0);
  const imbalance = (bidDepth - askDepth) / (bidDepth + askDepth);
  const cost = roundTripCostBps(config, snapshot.bid, snapshot.ask);
  // This is a historical-momentum hurdle, not a prediction or an estimate of future EV.
  const threshold = Math.max(5, cost * 1.5);
  const ready = fresh && !!reference && window.length >= 5;
  const reading: TapeReading = {samples: window.length, windowSeconds: latest && window.length ? (latest.time - window[0].time) / 1000 : 0,
    momentumBps: momentum, spreadBps: (snapshot.ask / snapshot.bid - 1) * 10_000, imbalance,
    roundTripCostBps: cost, thresholdBps: threshold, ready};
  const signal: Signal = {action: 'hold', reason: ready ? 'tape-waiting' : 'tape-warming', bar: latest?.quoteTime ?? 0,
    indicators: {fast: null, slow: null, rsi: null, macd: null, breakout: null}};
  if (!ready || momentum === null) return {signal, reading};
  if (inPosition && momentum < -5 && imbalance < -.1) return {signal: {...signal, action: 'sell', reason: 'tape-exit'}, reading};
  if (!inPosition && momentum > 0 && imbalance > .1) {
    if (momentum < threshold || config.targetPercent * 100 <= cost) return {signal: {...signal, reason: 'cost-gate'}, reading};
    return {signal: {...signal, action: 'buy', reason: 'tape-entry'}, reading};
  }
  return {signal, reading};
}
