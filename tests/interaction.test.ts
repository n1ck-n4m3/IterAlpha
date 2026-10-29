import test from 'node:test';
import assert from 'node:assert/strict';
import {appRoute, readAppRoute} from '../lib/app-navigation.ts';
import {SpiderQueue, isNewerVersion, spiderRequest, SpiderRequestError} from '../lib/spider/client.ts';
import {DEFAULT_AUDIO, readAudioSettings, SpiderAudio} from '../lib/spider/audio.ts';

test('app routes preserve feed and track options while recording each navigable view', () => {
  const spider = appRoute('?track=advanced&feed=browser&configure=1', 'spider');
  assert.equal(spider, '/app?track=advanced&feed=browser&view=spider');
  assert.deepEqual(readAppRoute(spider.slice(4)), {view: 'spider', configure: false, track: 'advanced'});
  const setup = appRoute(spider.slice(4), 'train', true);
  assert.equal(readAppRoute(setup.slice(4)).configure, true);
  assert.equal(readAppRoute('?view=not-a-page').view, 'train');
});
test('a control waits for an in-flight tick, uses its new version and recovers after a rejected operation', async () => {
  const queue = new SpiderQueue(), events: string[] = []; let release!: () => void, version = 0;
  const tick = queue.run(async () => {events.push('tick'); await new Promise<void>(resolve => {release = resolve;}); version++;});
  await Promise.resolve();
  const pause = queue.run(async () => {events.push(`pause-v${version}`); throw new Error('temporary');});
  const handled = assert.rejects(pause, /temporary/); assert.deepEqual(events, ['tick']); release(); await tick; await handled;
  await queue.run(async () => {events.push('reload');}); assert.deepEqual(events, ['tick', 'pause-v1', 'reload']);
  assert.equal(isNewerVersion({id: 'a', version: 3}, {id: 'a', version: 2}), false);
  assert.equal(isNewerVersion({id: 'a', version: 3}, {id: 'b', version: 0}), true);
});
test('client reports a typed conflict and an unreadable response instead of silently ignoring controls', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({error: 'Saved first.'}, {status: 409}));
  await assert.rejects(spiderRequest('/api/spiders/id/close', {version: 0}), (error: unknown) => error instanceof SpiderRequestError && error.status === 409 && error.message === 'Saved first.');
  t.mock.restoreAll(); t.mock.method(globalThis, 'fetch', async () => new Response('upstream unavailable', {status: 502}));
  await assert.rejects(spiderRequest('/api/spiders'), /spider request failed/);
});
test('client aborts a hung request with a useful timeout message', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(globalThis, 'fetch', (_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {init.signal?.addEventListener('abort', () => reject(new Error('aborted')));}));
  const request = spiderRequest('/api/spiders'), checked = assert.rejects(request, /timed out/); t.mock.timers.tick(12000); await checked;
});
test('sound settings preserve a zero volume and both toggles across reloads', () => {
  const saved = {effects: true, music: true, volume: 0}; assert.deepEqual(readAudioSettings(JSON.stringify(saved)), saved);
  assert.equal(readAudioSettings(null, '0').volume, 0); assert.deepEqual(readAudioSettings('invalid'), DEFAULT_AUDIO);
  assert.equal(readAudioSettings('{"volume":9}').volume, 1);
});
function fakeAudio() {
  const voices: {stops: number; disconnected: boolean; onended: (() => void) | null}[] = [];
  const context = {state: 'suspended', currentTime: 0, destination: {}, async resume() {this.state = 'running';}, async suspend() {this.state = 'suspended';}, async close() {this.state = 'closed';}, createGain() {return {gain: {value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}}, connect() {}, disconnect() {}};}, createOscillator() {const voice = {type: '', frequency: {value: 0}, stops: 0, disconnected: false, onended: null as (() => void) | null, start() {}, stop() {this.stops++;}, connect() {}, disconnect() {this.disconnected = true;}}; voices.push(voice); return voice;}};
  return {context, voices, engine: new SpiderAudio(() => context as unknown as AudioContext)};
}
test('audio unlock, repeated music toggles, suspension and cleanup do not duplicate or leak voices', async t => {
  t.mock.timers.enable({apis: ['setInterval']}); const {engine, context, voices} = fakeAudio();
  engine.setVolume(0); await engine.unlock(); assert.equal(engine.running, true); assert.equal(engine.volume, 0);
  engine.setMusic(true); assert.equal(voices.length, 7); engine.setMusic(true); assert.equal(voices.length, 7);
  engine.setMusic(false); assert(voices.every(voice => voice.disconnected)); const count = voices.length; t.mock.timers.tick(16000); assert.equal(voices.length, count);
  engine.effects = true; engine.cue('buy'); assert.equal(voices.length, count + 3);
  await engine.suspend(); assert.equal(context.state, 'suspended'); assert(voices.every(voice => voice.disconnected));
  engine.setMusic(true); await engine.resume(); assert.equal(voices.length, count + 10);
  engine.destroy(); assert.equal(context.state, 'closed'); assert(voices.every(voice => voice.disconnected)); t.mock.timers.tick(16000); assert.equal(voices.length, count + 10);
});
test('a blocked browser unlock rejects without claiming that audio is running', async () => {
  const {engine, context} = fakeAudio(); context.resume = async () => {throw new Error('blocked');};
  await assert.rejects(engine.unlock(), /blocked/); assert.equal(engine.running, false); engine.destroy();
});
test('a browser that leaves audio resume pending cannot leave a sound control busy forever', async t => {
  t.mock.timers.enable({apis: ['setTimeout']}); const {engine, context} = fakeAudio(); context.resume = () => new Promise<void>(() => {});
  const checked = assert.rejects(engine.unlock(), /did not enable audio in time/); t.mock.timers.tick(2500); await checked; assert.equal(engine.running, false); engine.destroy();
});
test('unsupported audio reports a recoverable error before any voice is scheduled', async () => {
  const engine = new SpiderAudio(() => {throw new Error('Audio is not supported in this browser.');});
  await assert.rejects(engine.unlock(), /not supported/); assert.equal(engine.running, false); engine.destroy();
});
