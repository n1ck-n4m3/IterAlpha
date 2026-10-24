import assert from 'node:assert/strict';
import test from 'node:test';
import {ema, macd, rsi, sma} from '../lib/training/indicators.ts';

test('SMA and EMA wait for enough visible bars', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 3), [null, null, 2, 3]);
  assert.deepEqual(ema([1, 2, 3, 4], 3), [null, null, 2, 3]);
});

test('indicators do not change past values when more bars are revealed', () => {
  const prices = Array.from({length: 60}, (_, index) => 100 + index * .6 + Math.sin(index));
  const first = macd(prices.slice(0, 45));
  const later = macd(prices);
  assert.deepEqual(first.line, later.line.slice(0, 45));
  assert.deepEqual(first.signal, later.signal.slice(0, 45));
  assert.deepEqual(first.histogram, later.histogram.slice(0, 45));
  assert.deepEqual(rsi(prices.slice(0, 45)), rsi(prices).slice(0, 45));
});

test('flat prices have a zero MACD histogram and neutral RSI', () => {
  const prices = Array(40).fill(100);
  const result = macd(prices);
  assert.equal(result.line.at(-1), 0);
  assert.equal(result.signal.at(-1), 0);
  assert.equal(result.histogram.at(-1), 0);
  assert.equal(rsi(prices).at(-1), 50);
});
