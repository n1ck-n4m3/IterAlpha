import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {advanceBot, createBot, EXECUTION, stats} from '../lib/spider/engine.ts';
import {evaluateStrategy} from '../lib/spider/strategy.ts';
import {parseBinanceMarkets, parseBinanceCandles, parseCoinbaseMarkets} from '../lib/server/spider-market.ts';
import {SpiderRepository} from '../lib/server/spider-repository.ts';
import {validateBrowserSnapshot} from '../lib/server/browser-snapshot.ts';
import {handleApi} from '../lib/server/api.ts';
import type {Config, Snapshot} from '../lib/spider/types.ts';

const now = 1_800_000_000_000;
const market = {id: 'binance:BTCUSDT', venue: 'binance' as const, symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', quantityStep: .001, minQuantity: .001, maxQuantity: 1e6, minNotional: 5};
const config: Config = {market, strategy: 'trend', interval: 60, initialCash: 10000, allocationPercent: 20, stopPercent: 1, targetPercent: 2};
function snapshot(time = now + 5000): Snapshot {
  const end = Math.floor(time / 60000) * 60 - 60;
  const candles = Array.from({length: 80}, (_, i) => {const close = 100 + i * .1 + i * i * .002; return {time: end - (79 - i) * 60, open: close - .1, close, low: close - .2, high: close + .2, volume: 1000};});
  const bid = candles.at(-1)!.close, ask = bid * 1.0001;
  return {market, interval: 60, candles, bids: [{price: bid, quantity: 10000}], asks: [{price: ask, quantity: 10000}], bid, ask, price: bid, quoteTime: time, fetchedAt: time, change24h: 1, source: 'Test exchange', mode: 'live'};
}
function database() {
  const sql = new DatabaseSync(':memory:'); for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  return {prepare(query: string) {const statement = sql.prepare(query); let params: unknown[] = []; const adapter = {bind(...values: unknown[]) {params = values; return adapter;}, async first() {return statement.get(...params as any[]) ?? null;}, async all() {return {results: statement.all(...params as any[])};}, async run() {const result = statement.run(...params as any[]); return {meta: {changes: Number(result.changes)}};}}; return adapter;}} as unknown as D1Database;
}

test('spider entry respects allocation and fees; completed trade PnL reconciles with cash', () => {
  const bot = createBot(crypto.randomUUID(), 'guest:test', config, now), quote = snapshot();
  const opened = advanceBot(bot, quote, now + 5000); assert.equal(opened.trades.length, 1); assert.equal(opened.trades[0].side, 'buy');
  assert(opened.entryCost <= config.initialCash * config.allocationPercent / 100); assert(opened.cash >= 8000); assert.equal(stats(opened).winRate, null);
  const expectedQuantity = Math.floor((2000 / (quote.ask * (1 + EXECUTION.slippage) * (1 + EXECUTION.fee))) / .001) * .001;
  assert(Math.abs(opened.quantity - expectedQuantity) < 1e-9);
  const later = snapshot(now + 10000); later.bid = quote.bid * 1.03; later.bids[0].price = later.bid; later.ask = later.bid * 1.0001; later.asks[0].price = later.ask;
  const closed = advanceBot(opened, later, now + 10000); assert.equal(closed.quantity, 0); assert.equal(closed.closedTrades, 1); assert.equal(stats(closed).winRate, 100);
  const received = opened.quantity * later.bid * (1 - EXECUTION.slippage) * (1 - EXECUTION.fee);
  assert(Math.abs(closed.cash - (opened.cash + received)) < 1e-8); assert(Math.abs(closed.realizedPnl - (closed.cash - 10000)) < 1e-8); assert.equal(closed.trades[1].reason, 'target');
});
test('spider never reuses a signal candle, consumes only completed consecutive candles', () => {
  const quote = snapshot(), opened = advanceBot(createBot('id', 'owner', config, now), quote, now + 5000);
  const again = advanceBot(opened, snapshot(now + 10000), now + 10000); assert.equal(again.trades.length, 1);
  const baseline = evaluateStrategy('trend', quote.candles, 60, now + 5000, false);
  const future = {...quote.candles.at(-1)!, time: Math.floor(now / 60000) * 60 + 60, close: 1e9, high: 1e9};
  assert.deepEqual(evaluateStrategy('trend', [...quote.candles, future], 60, now + 5000, false), baseline);
  const broken = quote.candles.filter((_, i) => i !== 65); assert.equal(evaluateStrategy('trend', broken, 60, now + 5000, false).reason, 'warming');
});
test('stale feed, missing monitoring interval, spread and insufficient depth never create fills', () => {
  const bot = createBot('id', 'owner', config, now);
  const stale = snapshot(); stale.quoteTime -= 20000; assert.equal(advanceBot(bot, stale, now + 5000).status, 'paused');
  assert.equal(advanceBot(bot, snapshot(now + 65000), now + 65000).events.at(-1)?.reason, 'gap');
  const wide = snapshot(); wide.ask = wide.bid * 1.01; wide.asks[0].price = wide.ask; const skipped = advanceBot(bot, wide, now + 5000); assert.equal(skipped.trades.length, 0); assert.equal(skipped.events.at(-1)?.reason, 'spread');
  const thin = snapshot(); thin.asks[0].quantity = .001; const noFill = advanceBot(bot, thin, now + 5000); assert.equal(noFill.trades.length, 0); assert.equal(noFill.events.at(-1)?.reason, 'liquidity');
});
test('gap stop fills at the current bid rather than the stop; drawdown guard pauses', () => {
  const opened = advanceBot(createBot('id', 'owner', {...config, allocationPercent: 50}, now), snapshot(), now + 5000);
  const lower = snapshot(now + 10000); lower.bid *= .8; lower.bids[0].price = lower.bid; lower.ask = lower.bid * 1.0001; lower.asks[0].price = lower.ask;
  const closed = advanceBot(opened, lower, now + 10000); assert.equal(closed.status, 'paused'); assert.equal(closed.quantity, 0); assert.equal(closed.trades[1].reason, 'drawdown');
  assert(closed.trades[1].price < opened.stop!); assert.equal(closed.wins, 0); assert.equal(closed.losses, 1); assert(stats(closed).maxDrawdown > 5);
});
test('market catalog includes non-USD quotes and excludes halted or non-spot symbols', () => {
  const row = {symbol: 'ETHBTC', baseAsset: 'ETH', quoteAsset: 'BTC', status: 'TRADING', isSpotTradingAllowed: true, filters: [{filterType: 'LOT_SIZE', stepSize: '.001', minQty: '.001', maxQty: '10000'}, {filterType: 'MIN_NOTIONAL', minNotional: '.0001'}]};
  const parsed = parseBinanceMarkets({symbols: [row, {...row, symbol: 'BADBTC', status: 'HALT'}, {...row, isSpotTradingAllowed: false}]}); assert.equal(parsed.length, 1); assert.equal(parsed[0].quote, 'BTC');
  assert.equal(parseCoinbaseMarkets([{id: 'BTC-USD', base_currency: 'BTC', quote_currency: 'USD', status: 'online', base_increment: '.00000001', min_market_funds: '1'}, {id: 'BAD-USD', status: 'offline'}]).length, 1);
  assert.throws(() => parseBinanceCandles([[now, 100, 101, 99, 110, 20]]));
});
test('persistent spiders isolate owners and atomically accept one of two competing fills', async () => {
  const repo = new SpiderRepository(database()), bot = createBot(crypto.randomUUID(), 'a', config, now);
  assert(await repo.create(bot)); assert.equal(await repo.find('b', bot.id), null);
  assert.equal(await repo.create(createBot(crypto.randomUUID(), 'a', config, now)), false);
  const next = advanceBot(bot, snapshot(), now + 5000); const result = await Promise.all([repo.save(bot, next), repo.save(bot, next)]);
  assert.equal(result.filter(Boolean).length, 1); assert.equal((await repo.find('a', bot.id))?.trades.length, 1);
});
test('spider controls require owner, same-origin request and valid schema; runner requires a secret', async () => {
  const db = database(), owner = `guest:${'a'.repeat(64)}`, bot = createBot(crypto.randomUUID(), owner, config, now); await new SpiderRepository(db).create(bot);
  const request = (path: string, body: unknown, cookie = `iteralpha_guest=${'a'.repeat(64)}`, headers = {}) => handleApi(new Request(`https://test.example${path}`, {method: 'POST', headers: {'content-type': 'application/json', 'x-iteralpha-request': '1', origin: 'https://test.example', cookie, ...headers}, body: JSON.stringify(body)}), {DB: db});
  const path = `/api/spiders/${bot.id}/pause`;
  assert.equal((await request(path, {version: 0}, `iteralpha_guest=${'b'.repeat(64)}`)).status, 404);
  assert.equal((await request(path, {version: 0}, undefined, {origin: 'https://evil.example'})).status, 403);
  assert.equal((await request(path, {version: 0, cash: 100000})).status, 400);
  assert.equal((await request(path, {version: 0})).status, 200);
  assert.equal((await request(path, {version: 0})).status, 409);
  assert.equal((await request('/api/spider/run', {})).status, 404);
});

test('browser paper feed keeps the ledger server-side and explicitly excludes verified rankings', async () => {
  const db = database(), owner = `guest:${'c'.repeat(64)}`, id = crypto.randomUUID();
  const bot = createBot(id, owner, {...config, feedMode:'browser'}, Date.now()-10000); await new SpiderRepository(db).create(bot);
  const request = async (action:string, body:unknown) => {
    const response=await handleApi(new Request(`https://test.example/api/spiders/${id}/${action}`,{method:'POST',headers:{'content-type':'application/json','x-iteralpha-request':'1',origin:'https://test.example',cookie:`iteralpha_guest=${'c'.repeat(64)}`},body:JSON.stringify(body)}),{DB:db});
    return {status:response.status,value:await response.json() as any};
  };
  const observed={...snapshot(Date.now()),source:'Binance Spot public market data'};
  const opened=await request('tick',{version:0,browserSnapshot:observed}); assert.equal(opened.status,200); assert.equal(opened.value.dataIntegrity,'browser-provided'); assert.equal(opened.value.rankEligible,false); assert.equal(opened.value.trades.length,1); assert(opened.value.cash<10000);
  const forged=await request('close',{version:opened.value.version,browserSnapshot:observed,cash:1000000}); assert.equal(forged.status,400);
  const wrong={...snapshot(Date.now()),source:'Binance Spot public market data'}; wrong.market={...wrong.market,id:'binance:ETHUSDT',symbol:'ETHUSDT',base:'ETH'};
  assert.equal((await request('close',{version:opened.value.version,browserSnapshot:wrong})).status,400);
  const closed=await request('close',{version:opened.value.version,browserSnapshot:{...snapshot(Date.now()),source:'Binance Spot public market data'}}); assert.equal(closed.status,200); assert.equal(closed.value.quantity,0); assert.equal(closed.value.closedTrades,1); assert.equal(closed.value.rankEligible,false);
});
test('always-on runner ignores browser-provided accounts and missing browser quotes pause execution', async () => {
  const db=database(), repo=new SpiderRepository(db), owner=`guest:${'d'.repeat(64)}`;
  const bot=createBot(crypto.randomUUID(),owner,{...config,feedMode:'browser'},Date.now()-10000);await repo.create(bot);
  assert.equal((await repo.running()).length,0);
  const response=await handleApi(new Request(`https://test.example/api/spiders/${bot.id}/tick`,{method:'POST',headers:{'content-type':'application/json','x-iteralpha-request':'1',origin:'https://test.example',cookie:`iteralpha_guest=${'d'.repeat(64)}`},body:JSON.stringify({version:0})}),{DB:db});
  const result=await response.json() as any;assert.equal(result.status,'paused');assert.equal(result.events.at(-1).reason,'feed-unavailable');assert.equal(result.trades.length,0);
});

test('active exchange symbols preserve Unicode ticker names without allowing URL syntax', () => {
  const row={symbol:'币安人生USDT',baseAsset:'币安人生',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true,filters:[{filterType:'LOT_SIZE',stepSize:'.01',minQty:'.01',maxQty:'1000000'}]};
  const parsed=parseBinanceMarkets({symbols:[row,{...row,symbol:'BAD/USDT'},{...row,symbol:'BAD?USDT'}]});
  assert.equal(parsed.length,1);assert.equal(parsed[0].base,'币安人生');assert.equal(parsed[0].id,'binance:币安人生USDT');
  const accepted=validateBrowserSnapshot({...snapshot(now),market:parsed[0],source:'Binance Spot public market data'},parsed[0].id,60,now);assert.equal(accepted.market.base,'币安人生');
});

test('fast paper settings are validated, persisted, and included in idempotency checks', async () => {
  const db = database();
  const body = {requestId: crypto.randomUUID(), feedMode: 'browser', browserSnapshot: {...snapshot(Date.now()), source: 'Binance Spot public market data'},
    marketId: market.id, strategy: 'tape', interval: 60, initialCash: 10000, allocationPercent: 20, stopPercent: .3, targetPercent: .6,
    evaluationSeconds: 5, cooldownSeconds: 15, feeBps: 60, slippageBps: 5};
  const request = (value: unknown) => handleApi(new Request('https://test.example/api/spiders', {method: 'POST', headers: {'content-type': 'application/json', 'x-iteralpha-request': '1', origin: 'https://test.example', cookie: `iteralpha_guest=${'e'.repeat(64)}`}, body: JSON.stringify(value)}), {DB: db});
  const created = await request(body); assert.equal(created.status, 200);
  const saved = await created.json() as any; assert.equal(saved.config.evaluationSeconds, 5); assert.equal(saved.config.feeBps, 60); assert.equal(saved.config.strategy, 'tape');
  assert.equal((await request(body)).status, 200);
  assert.equal((await request({...body, feeBps: 10})).status, 409);
  assert.equal((await request({...body, requestId: crypto.randomUUID(), evaluationSeconds: 1})).status, 400);
  assert.equal((await request({...body, requestId: crypto.randomUUID(), feeBps: -1})).status, 400);
});
