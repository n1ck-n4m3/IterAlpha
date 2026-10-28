import {TrainingError} from '../training/engine.ts';
import {z} from 'zod';
import type {Interval, Snapshot} from '../spider/types.ts';
const positive = z.number().finite().positive().max(1e30);
const level = z.object({price: positive, quantity: positive}).strict();
const market = z.object({id: z.string().regex(/^binance:[\p{L}\p{N}_]{2,40}$/u), venue: z.literal('binance'), symbol: z.string().regex(/^[\p{L}\p{N}_]{2,40}$/u), base: z.string().regex(/^[\p{L}\p{N}_]{1,30}$/u), quote: z.string().regex(/^[\p{L}\p{N}_]{1,30}$/u), quantityStep: positive, minQuantity: positive, maxQuantity: positive, minNotional: z.number().finite().min(0).max(1e30)}).strict();
export const browserSnapshotSchema = z.object({market, interval: z.union([z.literal(60), z.literal(300), z.literal(900)]),
  candles: z.array(z.object({time: z.number().int().positive(), open: positive, high: positive, low: positive, close: positive, volume: z.number().finite().min(0).max(1e30)}).strict()).min(2).max(200),
  bids: z.array(level).min(1).max(100), asks: z.array(level).min(1).max(100), price: positive, bid: positive, ask: positive,
  quoteTime: z.number().int().positive(), fetchedAt: z.number().int().positive(), change24h: z.number().finite().nullable(), mode: z.literal('live'), source: z.literal('Binance Spot public market data'),
}).strict();
/** Browser-supplied prices are deliberately unverified and never rank eligible. */
export function validateBrowserSnapshot(raw: unknown, marketId: string, interval: Interval, now: number): Snapshot {
  const value = browserSnapshotSchema.parse(raw);
  if (value.market.id !== marketId || value.market.id !== `binance:${value.market.symbol}` || value.market.symbol !== `${value.market.base}${value.market.quote}` || value.interval !== interval) throw new TrainingError('The browser feed does not match this market.');
  if (value.bid !== value.bids[0].price || value.ask !== value.asks[0].price || value.bid > value.ask) throw new TrainingError('The browser order book is inconsistent.');
  if (value.bids.some((row, i, all) => i > 0 && row.price >= all[i - 1].price) || value.asks.some((row, i, all) => i > 0 && row.price <= all[i - 1].price)) throw new TrainingError('The browser order book is not ordered.');
  if (value.candles.some((c, i, all) => c.high < c.low || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) || c.time * 1000 > now + 5000 || (i > 0 && c.time <= all[i - 1].time))) throw new TrainingError('The browser candle history is inconsistent.');
  return value;
}
