import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backtest} from '../lib/research/backtest.ts';
import {researchConfigSchema, researchDataSchema, type ResearchData} from '../lib/research/schema.ts';
import {selectPolicy, walkForward} from '../lib/research/walk-forward.ts';
import {authenticatedBroker, EXCHANGES, exchangeDefinition} from '../lib/exchanges/registry.ts';
import type {SpotBroker} from '../lib/exchanges/types.ts';

const config = researchConfigSchema.parse({...JSON.parse(readFileSync('config/research.example.json', 'utf8')),
  selectionBars: 200, testBars: 100, minimumTrades: 1, feeBps: 10, spreadBps: 2, slippageBps: 5});
function dataset(length = 800): ResearchData {
  const start = Math.floor(1_650_000_000 / 60) * 60;
  return researchDataSchema.parse({version: 'iteralpha-research-data-v1', venue: 'binance', symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', interval: 60,
    source: {url: 'https://example.com/test-fixture', retrievedAt: '2026-01-01T00:00:00.000Z', usage: 'personal-research', rightsConfirmed: true, kind: 'synthetic-test'},
    rules: {quantityStep: .000001, minQuantity: .000001, maxQuantity: 1e9, minNotional: 1, provenance: 'Assumed test instrument rules, not historical exchange rules.'},
    candles: Array.from({length}, (_, i) => {const open = 100 + i * .05 + i * i * .0001; return {time: start + i * 60, open, close: open + .04, high: open + .05, low: open - .02, volume: 1e9};})});
}

test('exchange inventory keeps unsupported venues out of authenticated execution', () => {
  assert.equal(new Set(EXCHANGES.map(row => row.id)).size, EXCHANGES.length);
  assert.equal(exchangeDefinition('coinbase').priority, 1);
  assert.equal(exchangeDefinition('coinbase').sandbox, 'static-responses');
  assert.notEqual(exchangeDefinition('binance').id, exchangeDefinition('binance-us').id);
  assert.throws(() => exchangeDefinition('unknown'));
  for (const row of EXCHANGES) assert.throws(() => authenticatedBroker(row.id, []));
  const adapter = {exchange: 'coinbase'} as SpotBroker;
  assert.equal(authenticatedBroker('coinbase', [adapter]), adapter);
  assert.throws(() => authenticatedBroker('coinbase', [adapter, adapter]));
  assert.throws(() => authenticatedBroker('okx', [adapter]));
});
test('research input rejects gaps, duplicates, invalid geometry, future bars, and unconfirmed rights', () => {
  const data = dataset();
  const gap = structuredClone(data); gap.candles.splice(200, 1); assert.equal(researchDataSchema.safeParse(gap).success, false);
  const duplicate = structuredClone(data); duplicate.candles[201].time = duplicate.candles[200].time; assert.equal(researchDataSchema.safeParse(duplicate).success, false);
  const invalid = structuredClone(data); invalid.candles[100].high = 1; assert.equal(researchDataSchema.safeParse(invalid).success, false);
  const future = structuredClone(data); const offset = Math.ceil(Date.now() / 60000) * 60 - future.candles[0].time; future.candles.forEach(c => c.time += offset); assert.equal(researchDataSchema.safeParse(future).success, false);
  assert.equal(researchDataSchema.safeParse({...data, source: {...data.source, rightsConfirmed: false}}).success, false);
});
test('research entries use a closed previous bar and next open, with reconciled fee-inclusive PnL', () => {
  const data = dataset(); const result = backtest(data, config, 'trend', 160, 260);
  assert(result.fills.length > 1);
  const first = result.fills[0], bar = data.candles[160];
  assert.equal(first.side, 'buy'); assert.equal(first.signalTime, bar.time - 60); assert.equal(first.time, bar.time);
  assert.equal(first.price, bar.open * (1 + (config.spreadBps / 2 + config.slippageBps) / 10000));
  const received = result.fills.reduce((sum, fill) => sum + (fill.side === 'buy' ? -(fill.price * fill.quantity + fill.fee) : fill.price * fill.quantity - fill.fee), config.initialCash);
  assert(Math.abs(received - result.finalCash) < 1e-8);
  assert(Math.abs(result.fills.reduce((sum, fill) => sum + (fill.netPnl ?? 0), 0) - result.netPnl) < 1e-8);
  assert(result.fees > 0); assert(result.fills.every(fill => fill.signalTime === null || fill.signalTime < fill.time));
});
test('same-bar stop and target choose the adverse exit; gap stops fill at the lower open', () => {
  const data = dataset(); data.candles[160].low = 50; data.candles[160].high = 200;
  const result = backtest(data, config, 'trend', 160, 162);
  assert.equal(result.fills[1].reason, 'stop'); assert(result.fills[1].netPnl! < 0);
  const gap = dataset(); gap.candles[161] = {...gap.candles[161], open: 50, high: 51, low: 49, close: 50};
  const gapped = backtest(gap, config, 'trend', 160, 162);
  assert.equal(gapped.fills[1].time, gap.candles[161].time); assert(gapped.fills[1].price < 50);
});
test('entry capacity uses prior volume and never reads the fill bar volume', () => {
  const data = dataset(); data.candles[159].volume = 0;
  const a = backtest(data, config, 'trend', 160, 161); assert.equal(a.fills.length, 0); assert.equal(a.rejectedEntries, 1);
  data.candles[160].volume = 1e15;
  assert.deepEqual(backtest(data, config, 'trend', 160, 161), a);
});
test('higher assumed costs lower the same buy-and-hold baseline; cash stays flat', () => {
  const data = dataset(); const low = backtest(data, {...config, feeBps: 0, spreadBps: 0, slippageBps: 0}, 'buy-hold', 160, 260);
  const high = backtest(data, {...config, feeBps: 100, spreadBps: 50, slippageBps: 50}, 'buy-hold', 160, 260);
  assert(high.finalCash < low.finalCash); assert.equal(high.closedTrades, 1);
  const cash = backtest(data, config, 'cash', 160, 260); assert.equal(cash.returnPercent, 0); assert.equal(cash.closedTrades, 0); assert.equal(cash.meanNetPnlPerTrade, null);
});
test('policy selection abstains on sparse or unprofitable evidence', () => {
  const data = dataset(); const result = backtest(data, config, 'trend', 160, 360);
  assert.equal(selectPolicy([result], {...config, minimumTrades: 1000}).selected, 'cash');
  assert.equal(selectPolicy([{...result, netPnl: -1}], config).selected, 'cash');
  assert.equal(selectPolicy([{...result, halted: true}], config).selected, 'cash');
});
test('future price mutation cannot change earlier fold selection or fills', () => {
  const data = dataset(), original = walkForward(data, config), changed = structuredClone(data);
  const cutoff = 160 + config.selectionBars + config.testBars;
  changed.candles.slice(cutoff).forEach(c => {c.open *= 10; c.high *= 10; c.low *= 10; c.close *= 10;});
  const rerun = walkForward(changed, config);
  assert.deepEqual(rerun.folds[0], original.folds[0]);
  assert.equal(original.folds[0].selectionEnd, original.folds[0].testStart);
  for (const fold of original.folds) for (const row of fold.candidates) assert(row.result.fills.every(fill => fill.time <= fold.testStart));
  assert.equal(original.modelUsed, false); assert.equal(original.liveFundsEnabled, false);
});
test('drawdown state survives a fold boundary and prevents new entries', () => {
  const data = dataset();
  const result = backtest(data, {...config, initialCash: 9400}, 'trend', 160, 260, {peakEquity: 10000, halted: true});
  assert.equal(result.fills.length, 0); assert.equal(result.halted, true); assert.equal(result.finalCash, 9400);
});
