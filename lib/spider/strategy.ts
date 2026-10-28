import {macd, rsi, sma} from '../training/indicators.ts';
import type {Candle} from '../training/types.ts';
import type {Interval, Signal, Strategy} from './types.ts';

export function evaluateStrategy(strategy: Strategy, candles: Candle[], interval: Interval, now: number, inPosition: boolean): Signal {
  const bars = candles.filter(c => (c.time + interval) * 1000 <= now);
  const closes = bars.map(c => c.close);
  const fast = sma(closes, 7).at(-1) ?? null;
  const slow = sma(closes, 25).at(-1) ?? null;
  const strength = rsi(closes);
  const momentum = macd(closes).histogram.at(-1) ?? null;
  const high = bars.length > 20 ? Math.max(...bars.slice(-21, -1).map(c => c.high)) : null;
  const result: Signal = {action: 'hold', reason: 'waiting', bar: bars.at(-1)?.time ?? 0, indicators: {fast, slow, rsi: strength.at(-1) ?? null, macd: momentum, breakout: high}};
  if (bars.length < 40 || bars.slice(-40).some((c, i, a) => i > 0 && c.time !== a[i - 1].time + interval)) return {...result, reason: 'warming'};
  if (strategy === 'trend') {
    if (!inPosition && fast! > slow! && momentum! > 0) return {...result, action: 'buy', reason: 'trend-entry'};
    if (inPosition && fast! < slow!) return {...result, action: 'sell', reason: 'trend-exit'};
  } else if (strategy === 'reversion') {
    if (!inPosition && strength.at(-2)! <= 30 && strength.at(-1)! > 30) return {...result, action: 'buy', reason: 'reversion-entry'};
    if (inPosition && strength.at(-1)! >= 60) return {...result, action: 'sell', reason: 'reversion-exit'};
  } else {
    const prior = bars.slice(-21, -1);
    const averageVolume = prior.reduce((sum, c) => sum + (c.volume ?? 0), 0) / 20;
    if (!inPosition && closes.at(-1)! > high! && averageVolume > 0 && (bars.at(-1)!.volume ?? 0) >= averageVolume * 1.2) return {...result, action: 'buy', reason: 'breakout-entry'};
    if (inPosition && closes.at(-1)! < fast!) return {...result, action: 'sell', reason: 'breakout-exit'};
  }
  return result;
}
