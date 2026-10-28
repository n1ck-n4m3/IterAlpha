import test from 'node:test';
import assert from 'node:assert/strict';
import {DECISION_MODEL, DECISION_REVISION, decisionRequest, validateDecisionResult, openDecisionFeedback} from '../lib/server/decision-provider.ts';
import {advanceSession, createSession} from '../lib/training/engine.ts';
import {scenes} from '../lib/server/scenes.ts';
const expected = {model: DECISION_MODEL, revision: DECISION_REVISION};
const result = () => ({version: 'iteralpha-decider-v1', ...expected, quantization: 'nf4', results: [
  {id: 'support', option_ids: ['supported', 'mixed', 'insufficient'], scores: [.1, .1, .8], prompt_sha256: 'a'.repeat(64)},
  {id: 'focus', option_ids: ['sizing', 'stops', 'costs', 'evidence', 'patience', 'insufficient'], scores: [.8, .04, .04, .04, .04, .04], prompt_sha256: 'b'.repeat(64)},
]});
test('open decider rejects changed models, malformed distributions and invented options', () => {
  assert.equal(validateDecisionResult(result(), expected).status, 'ready');
  assert.throws(() => validateDecisionResult({...result(), revision: 'f'.repeat(40)}, expected));
  const invalid = result(); invalid.results[0].scores = [.8, .8, .8]; assert.throws(() => validateDecisionResult(invalid, expected));
  const invented = result(); invented.results[0].option_ids[0] = 'buy'; assert.throws(() => validateDecisionResult(invented, expected));
  const ambiguous = result(); ambiguous.results[0].scores = [.34, .33, .33]; const checked = validateDecisionResult(ambiguous, expected); assert(checked.status === 'ready'); assert.equal(checked.support, 'uncertain');
});
test('open decider receives only cutoff evidence and falls back when offline', async () => {
  const scene = scenes[0], session = advanceSession(createSession(scene, 'private-owner', crypto.randomUUID(), new Date().toISOString()), scene, {action: 'wait', version: 0, requestId: crypto.randomUUID()}, new Date().toISOString());
  const request = JSON.stringify(decisionRequest(session, scene)); assert(!request.includes('private-owner')); for (const row of decisionRequest(session, scene).rows) {assert(!('outcome' in row.state)); assert(!('candles' in row.state)); assert(row.state.evidence.every(e => Date.parse(e.availableAt) <= (scene.candles[scene.nodes[session.decisions.at(-1)!.node]].time + scene.source.intervalSeconds) * 1000));}
  const feedback = await openDecisionFeedback(session, scene, {DECISION_API_URL: 'https://model.example/v1/decide', DECISION_API_KEY: 'x'.repeat(32)}, async () => {throw new Error('Unavailable.');});
  assert.equal(feedback.mode, 'rules'); assert.equal(feedback.decisionAssessment?.status, 'unavailable');
});
