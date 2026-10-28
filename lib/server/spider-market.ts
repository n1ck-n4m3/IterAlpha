import {parseBinanceMarkets, parseBinanceCandles, parseLevels} from '../spider/exchange.ts';
export {parseBinanceMarkets, parseBinanceCandles, parseLevels} from '../spider/exchange.ts';
import type {Candle} from '../training/types.ts';
import type {Interval, Level, Market, Snapshot, Venue} from '../spider/types.ts';
import {parseCoinbaseCandles} from './live-market.ts';

export interface MarketEnvironment {COINBASE_MARKET_DATA_LICENSED?: string}
const directoryCache = new Map<Venue, {until: number; markets: Market[]}>();
const snapshotCache = new Map<string, {until: number; value: Snapshot}>();
const inflight = new Map<string, Promise<Snapshot>>();
const positive = (value: unknown) => {const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid market number.'); return n;};
async function request(url: string): Promise<{data: unknown; time: number}> {
  const response = await fetch(url, {headers: {Accept: 'application/json', 'User-Agent': 'IterAlpha/0.4'}, signal: AbortSignal.timeout(8000), redirect: 'manual'}).catch(error => {console.warn(JSON.stringify({event:'exchange_connection_error',host:new URL(url).hostname,error:error instanceof Error?error.message:'Connection failed.'}));throw error;});
  if (!response.ok) {console.warn(JSON.stringify({event:'exchange_http_error',host:new URL(url).hostname,status:response.status}));throw new Error(`Exchange returned HTTP ${response.status}.`);}
  const date = Date.parse(response.headers.get('date') ?? '');
  let data: unknown; try {data = await response.json();} catch {throw new Error('Exchange returned a non-JSON response.');}
  return {data, time: Number.isFinite(date) ? date : Date.now()};
}
export function parseCoinbaseMarkets(raw: unknown): Market[] {
  if (!Array.isArray(raw)) throw new Error('Invalid exchange directory.');
  return raw.flatMap(row => {
    if (row.status !== 'online' || row.trading_disabled || row.cancel_only || row.post_only || row.limit_only || !/^[\p{L}\p{N}-]{3,60}$/u.test(row.id)) return [];
    try {return [{id: `coinbase:${row.id}`, venue: 'coinbase' as const, symbol: row.id, base: row.base_currency, quote: row.quote_currency,
      quantityStep: positive(row.base_increment), minQuantity: Number(row.base_min_size) || positive(row.base_increment), maxQuantity: Number(row.base_max_size) || Number.MAX_VALUE, minNotional: positive(row.min_market_funds ?? 1)}];}
    catch {return [];}
  });
}
export async function marketDirectory(venue: Venue, env: MarketEnvironment): Promise<Market[]> {
  if (venue === 'coinbase' && env.COINBASE_MARKET_DATA_LICENSED !== 'true') throw new Error('Coinbase market-data display is not configured.');
  const cached = directoryCache.get(venue); if (cached && cached.until > Date.now()) return cached.markets;
  const {data} = await request(venue === 'binance' ? 'https://data-api.binance.vision/api/v3/exchangeInfo' : 'https://api.exchange.coinbase.com/products');
  const markets = venue === 'binance' ? parseBinanceMarkets(data) : parseCoinbaseMarkets(data);
  if (!markets.length) throw new Error('No active spot markets are available.');
  markets.sort((a, b) => a.base.localeCompare(b.base) || a.quote.localeCompare(b.quote));
  directoryCache.set(venue, {until: Date.now() + 300_000, markets}); return markets;
}
export async function marketCatalog(env: MarketEnvironment) {
  const venues = ['binance', 'coinbase'] as const;
  const results = await Promise.allSettled(venues.map(v => marketDirectory(v, env)));
  return {markets: results.flatMap(r => r.status === 'fulfilled' ? r.value : []), venues: venues.map((venue, i) => ({venue,
    status: venue === 'coinbase' && env.COINBASE_MARKET_DATA_LICENSED !== 'true' ? 'permission-required' : results[i].status === 'fulfilled' ? 'connected' : 'unavailable',
    count: results[i].status === 'fulfilled' ? results[i].value.length : 0,
    diagnostic: results[i].status === 'rejected' ? String(results[i].reason instanceof Error ? results[i].reason.message : 'Exchange connection failed.').slice(0, 180) : null})), refreshedAt: Date.now()};
}
export async function resolveMarket(id: string, env: MarketEnvironment): Promise<Market | null> {
  const venue = id.split(':')[0]; if (venue !== 'binance' && venue !== 'coinbase') return null;
  return (await marketDirectory(venue, env)).find(m => m.id === id) ?? null;
}
async function loadSnapshot(market: Market, interval: Interval): Promise<Snapshot> {
  const selected = encodeURIComponent(market.symbol);
  let chart: Candle[], book: Record<string, unknown>, time: number, change24h: number | null = null, price: number;
  if (market.venue === 'binance') {
    const base = 'https://data-api.binance.vision/api/v3';
    const [candles, depth, ticker] = await Promise.all([
      request(`${base}/klines?symbol=${selected}&interval=${interval / 60}m&limit=160`),
      request(`${base}/depth?symbol=${selected}&limit=100`), request(`${base}/ticker/24hr?symbol=${selected}`),
    ]);
    chart = parseBinanceCandles(candles.data); book = depth.data as Record<string, unknown>; time = depth.time;
    const t = ticker.data as Record<string, unknown>; price = positive(t.lastPrice); const change = Number(t.priceChangePercent); if (Number.isFinite(change)) change24h = change;
  } else {
    const base = `https://api.exchange.coinbase.com/products/${selected}`;
    const [candles, depth, ticker] = await Promise.all([request(`${base}/candles?granularity=${interval}`), request(`${base}/book?level=2`), request(`${base}/ticker`)]);
    chart = parseCoinbaseCandles(candles.data).slice(-160); book = depth.data as Record<string, unknown>; time = depth.time; price = positive((ticker.data as {price: unknown}).price);
  }
  const bids = parseLevels(book.bids, 'bids'), asks = parseLevels(book.asks, 'asks');
  if (bids[0].price > asks[0].price || chart.length < 2) throw new Error('Inconsistent market snapshot.');
  return {market, interval, candles: chart, bids, asks, bid: bids[0].price, ask: asks[0].price, price, quoteTime: time, fetchedAt: Date.now(), change24h, mode: 'live', source: market.venue === 'binance' ? 'Binance Spot public market data' : 'Coinbase Exchange'};
}
export async function spiderSnapshot(market: Market, interval: Interval): Promise<Snapshot> {
  const key = `${market.id}:${interval}`, cached = snapshotCache.get(key); if (cached && cached.until > Date.now()) return cached.value;
  const pending = inflight.get(key); if (pending) return pending;
  const loading = loadSnapshot(market, interval).then(value => {if (snapshotCache.size > 100) snapshotCache.clear(); snapshotCache.set(key, {until: Date.now() + 4000, value}); return value;}).finally(() => inflight.delete(key));
  inflight.set(key, loading); return loading;
}
