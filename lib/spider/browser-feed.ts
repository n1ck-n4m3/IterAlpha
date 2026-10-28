import type {Interval, Market, Snapshot} from './types.ts';
import {parseBinanceCandles, parseBinanceMarkets, parseLevels} from './exchange.ts';
let directory: {until: number; markets: Market[]} | null = null;
const cache = new Map<string, Snapshot>();
async function read(path: string): Promise<unknown> {
  const response = await fetch(`https://data-api.binance.vision/api/v3/${path}`, {credentials: 'omit', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('The exchange is unavailable from this browser. No prices have been substituted.');
  return response.json();
}
export async function browserDirectory(): Promise<Market[]> {
  if (directory && directory.until > Date.now()) return directory.markets;
  const markets = parseBinanceMarkets(await read('exchangeInfo'));
  if (!markets.length) throw new Error('The browser could not load the active spot directory.');
  markets.sort((a, b) => a.base.localeCompare(b.base) || a.quote.localeCompare(b.quote));
  directory = {until: Date.now() + 300000, markets}; return markets;
}
export async function browserSnapshot(market: Market, interval: Interval): Promise<Snapshot> {
  if (market.venue !== 'binance') throw new Error('Direct browser quotes are available only for Binance spot markets.');
  const key = `${market.id}:${interval}`, cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < 3500) return cached;
  const symbol = encodeURIComponent(market.symbol);
  const [rawCandles, rawDepth, rawTicker] = await Promise.all([read(`klines?symbol=${symbol}&interval=${interval / 60}m&limit=160`), read(`depth?symbol=${symbol}&limit=100`), read(`ticker/24hr?symbol=${symbol}`)]);
  const depth = rawDepth as {bids: unknown; asks: unknown}, ticker = rawTicker as {lastPrice: string; priceChangePercent: string};
  const candles = parseBinanceCandles(rawCandles), bids = parseLevels(depth.bids, 'bids'), asks = parseLevels(depth.asks, 'asks');
  const price = Number(ticker.lastPrice), change = Number(ticker.priceChangePercent);
  if (!Number.isFinite(price) || price <= 0 || bids[0].price > asks[0].price || candles.length < 2) throw new Error('The live market response is inconsistent.');
  const value: Snapshot = {market, interval, candles, bids, asks, bid: bids[0].price, ask: asks[0].price, price, quoteTime: Date.now(), fetchedAt: Date.now(), change24h: Number.isFinite(change) ? change : null, mode: 'live', source: 'Binance Spot public market data'};
  if (cache.size > 10) cache.clear(); cache.set(key, value); return value;
}
