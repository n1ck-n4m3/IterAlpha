import type {Candle} from '../training/types.ts';
import type {Level, Market} from './types.ts';
const positive = (value: unknown) => {const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid market number.'); return n;};
export function parseBinanceMarkets(raw: unknown): Market[] {
  const rows = (raw as {symbols?: unknown[]})?.symbols; if (!Array.isArray(rows)) throw new Error('Invalid exchange directory.');
  const markets: Market[] = [];
  for (const item of rows) {
    const row = item as Record<string, unknown>;
    if (row.status !== 'TRADING' || row.isSpotTradingAllowed !== true || !/^[\p{L}\p{N}_]{2,40}$/u.test(String(row.symbol))) continue;
    try {
      const filters = row.filters as Record<string, unknown>[];
      const lot = filters.find(f => f.filterType === 'LOT_SIZE');
      const marketLot = filters.find(f => f.filterType === 'MARKET_LOT_SIZE');
      const notional = filters.find(f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL');
      if (!lot) continue;
      const base = String(row.baseAsset), quote = String(row.quoteAsset);
      if (!/^[\p{L}\p{N}_]{1,30}$/u.test(base) || !/^[\p{L}\p{N}_]{1,30}$/u.test(quote)) continue;
      const step = Number(marketLot?.stepSize) > 0 ? positive(marketLot!.stepSize) : positive(lot.stepSize);
      markets.push({id: `binance:${row.symbol}`, venue: 'binance', symbol: String(row.symbol), base, quote,
        quantityStep: Math.max(step, positive(lot.stepSize)), minQuantity: Math.max(Number(marketLot?.minQty) || 0, positive(lot.minQty)),
        maxQuantity: Math.min(Number(marketLot?.maxQty) > 0 ? Number(marketLot!.maxQty) : Infinity, positive(lot.maxQty)),
        minNotional: Number(notional?.minNotional) > 0 ? positive(notional!.minNotional) : 0});
    } catch { /* Skip symbols with incomplete execution rules. */ }
  }
  return markets;
}

export function parseLevels(raw: unknown, side: 'bids' | 'asks'): Level[] {
  if (!Array.isArray(raw)) throw new Error('Invalid order book.');
  const levels = raw.slice(0, 100).map(row => {if (!Array.isArray(row)) throw new Error('Invalid order-book level.'); return {price: positive(row[0]), quantity: positive(row[1])};});
  levels.sort((a, b) => side === 'bids' ? b.price - a.price : a.price - b.price);
  if (!levels.length) throw new Error('Empty order book.'); return levels;
}

export function parseBinanceCandles(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) throw new Error('Invalid candle history.');
  const candles = raw.map(row => {
    if (!Array.isArray(row) || row.length < 6) throw new Error('Invalid candle.');
    const [timestamp, open, high, low, close, volume] = row.map(Number);
    if (![timestamp, open, high, low, close, volume].every(Number.isFinite) || timestamp <= 0 || low <= 0 || high < low || open < low || open > high || close < low || close > high || volume < 0) throw new Error('Invalid candle values.');
    return {time: timestamp / 1000, open, high, low, close, volume};
  });
  return candles.sort((a, b) => a.time - b.time).filter((c, i, a) => !i || c.time !== a[i - 1].time);
}
