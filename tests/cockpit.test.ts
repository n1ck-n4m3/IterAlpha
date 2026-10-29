import test from 'node:test';
import assert from 'node:assert/strict';
import {cockpitMode, cycleChecks, executionResult, normalizedSeries} from '../lib/spider/cockpit.ts';
import type {BotView, Cycle} from '../lib/spider/types.ts';
const bot = {status: 'running', trace: [{stage: 'execution', status: 'filled'}]} as BotView;
const record = {time: 100, action: 'hold', reason: 'spread', evidence: {proposedAction: 'buy', checks: [{stage: 'risk', status: 'blocked', reason: 'spread'}]}} as Cycle;
test('a disconnected or paused spider never presents the active execution mode', () => {
  assert.equal(cockpitMode(bot, true, null), 'live');
  assert.equal(cockpitMode(bot, false, null), 'offline');
  assert.equal(cockpitMode({...bot, status: 'paused'}, true, null), 'paused');
  assert.equal(cockpitMode(null, true, null), 'preview');
});
test('recorded checks are visibly separate from live monitoring even when the feed is unavailable', () => {
  assert.equal(cockpitMode(bot, false, record), 'replay');
  assert.deepEqual(cycleChecks(bot, record), record.evidence!.checks);
  assert.notDeepEqual(cycleChecks(bot, record), bot.trace);
});
test('old checks without evidence do not borrow the current bot risk result', () => {
  assert.deepEqual(cycleChecks(bot, {...record, evidence: undefined}), []);
  assert.deepEqual(cycleChecks(null, null), []);
});
test('a blocked buy proposal remains a hold in the visualization', () => {
  assert.equal(record.evidence?.proposedAction, 'buy');
  assert.equal(executionResult(record), 'hold');
  assert.equal(executionResult(null), 'empty');
});
test('sparkline paths require actual finite samples and preserve their observed ordering', () => {
  assert.equal(normalizedSeries([]), ''); assert.equal(normalizedSeries([1]), ''); assert.equal(normalizedSeries([1,NaN]), '');
  assert.equal(normalizedSeries([1,2,3]), 'M0.00,41.00 L120.00,23.00 L240.00,5.00');
  assert.equal(normalizedSeries([4,4]), 'M0.00,41.00 L240.00,41.00');
  assert.equal(normalizedSeries([3,2,1]), 'M0.00,5.00 L120.00,23.00 L240.00,41.00');
});
