import {z} from 'zod';
import {TrainingError} from '../training/engine.ts';
import {advanceBot, createBot, pauseBot, publicBot, snapshotUsable} from '../spider/engine.ts';
import type {Bot, Interval} from '../spider/types.ts';
import {marketCatalog, resolveMarket, spiderSnapshot, type MarketEnvironment} from './spider-market.ts';
import {browserSnapshotSchema, validateBrowserSnapshot} from './browser-snapshot.ts';
import {SpiderRepository} from './spider-repository.ts';

export interface SpiderEnvironment extends MarketEnvironment {DB?: D1Database; SPIDER_RUNNER_KEY?: string}
const startSchema = z.object({feedMode:z.enum(['server','browser']).default('server'),browserSnapshot:browserSnapshotSchema.optional(),requestId: z.string().uuid(), marketId: z.string().max(80), strategy: z.enum(['trend', 'reversion', 'breakout', 'tape']),
  interval: z.union([z.literal(60), z.literal(300), z.literal(900)]), initialCash: z.number().finite().min(0.0001).max(1_000_000_000),
  evaluationSeconds: z.union([z.literal(5), z.literal(15), z.literal(30)]).default(5),
  cooldownSeconds: z.number().int().min(0).max(300).default(0), feeBps: z.number().finite().min(0).max(200).default(10), slippageBps: z.number().finite().min(0).max(100).default(5),
  allocationPercent: z.number().finite().min(1).max(50).default(20), stopPercent: z.number().finite().min(0.2).max(10).default(1), targetPercent: z.number().finite().min(0.4).max(20).default(2)}).strict();
const commandSchema = z.object({browserSnapshot:browserSnapshotSchema.optional(),version: z.number().int().min(0)}).strict();
export async function runSpider(bot: Bot, env: SpiderEnvironment): Promise<Bot> {
  if(bot.config.feedMode==='browser')return bot;
  try {const market = await resolveMarket(bot.config.market.id, env); if (!market) return pauseBot(bot, Date.now(), 'feed-unavailable');
    return advanceBot(bot, await spiderSnapshot(market, bot.config.interval), Date.now());
  } catch {return pauseBot(bot, Date.now(), 'feed-unavailable');}
}
export async function handleSpider(path: string, request: Request, env: SpiderEnvironment, owner: string, readBody: (r: Request, limit?: number) => Promise<unknown>): Promise<unknown> {
  const url = new URL(request.url);
  if (path === '/api/spider/markets' && request.method === 'GET') return marketCatalog(env);
  if (path === '/api/spider/market' && request.method === 'GET') {
    const id = url.searchParams.get('market') ?? 'binance:BTCUSDT';
    const interval = Number(url.searchParams.get('interval') ?? 60);
    if (![60, 300, 900].includes(interval) || id.length > 80) throw new TrainingError('Unsupported market request.');
    const market = await resolveMarket(id, env).catch(() => {throw new TrainingError('The live exchange directory is unavailable. Please retry shortly.', 503);}); if (!market) throw new TrainingError('This spot market is not currently available.', 404);
    try {return await spiderSnapshot(market, interval as Interval);} catch {throw new TrainingError('The live feed is unavailable. No synthetic prices or trades have been substituted.', 503);}
  }
  if (!env.DB) throw new TrainingError('Spider storage is unavailable.', 503);
  const repo = new SpiderRepository(env.DB);
  if (path === '/api/spiders' && request.method === 'GET') return {bots: (await repo.list(owner)).map(publicBot), runnerConfigured: !!env.SPIDER_RUNNER_KEY};
  if (path === '/api/spiders' && request.method === 'POST') {
    const input = startSchema.parse(await readBody(request, 131072));
    const existing = await repo.find(owner, input.requestId);
    if (existing) {
      const c = existing.config;
      if ((c.feedMode??'server')!==input.feedMode || c.market.id !== input.marketId || c.strategy !== input.strategy || c.interval !== input.interval || c.initialCash !== input.initialCash || c.allocationPercent !== input.allocationPercent || c.stopPercent !== input.stopPercent || c.targetPercent !== input.targetPercent || (c.evaluationSeconds??5)!==input.evaluationSeconds || (c.cooldownSeconds??0)!==input.cooldownSeconds || (c.feeBps??10)!==input.feeBps || (c.slippageBps??5)!==input.slippageBps) throw new TrainingError('This request ID belongs to another spider.', 409);
      return publicBot(existing);
    }
    const direct=input.feedMode==='browser'?validateBrowserSnapshot(input.browserSnapshot,input.marketId,input.interval,Date.now()):null;
    const market = direct?.market ?? await resolveMarket(input.marketId, env); if (!market) throw new TrainingError('This spot market is no longer available.', 404);
    let snapshot;
    try {snapshot = direct ?? await spiderSnapshot(market, input.interval);} catch {throw new TrainingError('A fresh live feed is required to start a spider.', 503);}
    if (!snapshotUsable(snapshot, Date.now())) throw new TrainingError('The exchange snapshot is stale. Try again shortly.', 503);
    if (input.initialCash * input.allocationPercent / 100 < market.minNotional * 1.01) throw new TrainingError(`Increase the balance or allocation. This market requires at least ${market.minNotional} ${market.quote} per order.`);
    const {requestId: _requestId, marketId: _marketId, browserSnapshot: _snapshot, ...configuration} = input;
    const bot = createBot(input.requestId, owner, {...configuration, market}, Date.now()); bot.lastMark = snapshot.bid;
    if (!await repo.create(bot)) throw new TrainingError('Pause your running spider before starting another. Limit: 20 new paper accounts per day.', 409);
    return publicBot(bot);
  }
  const match = path.match(/^\/api\/spiders\/([0-9a-f-]{36})\/(tick|pause|resume|close)$/);
  if (!match || request.method !== 'POST') throw new TrainingError('Not found.', 404);
  const bot = await repo.find(owner, match[1]); if (!bot) throw new TrainingError('Spider not found.', 404);
  const input = commandSchema.parse(await readBody(request, 131072));
  if (match[2] !== 'tick' && input.version !== bot.version) throw new TrainingError('The spider changed. Refresh before sending this control again.', 409);
  let next: Bot;
  if (match[2] === 'pause') next = pauseBot(bot, Date.now());
  else if (match[2] === 'tick' && bot.config.feedMode === 'browser' && !input.browserSnapshot) next = pauseBot(bot, Date.now(), 'feed-unavailable');
  else if (match[2] === 'tick' && bot.config.feedMode !== 'browser') next = await runSpider(bot, env);
  else {
    const direct=bot.config.feedMode==='browser'?validateBrowserSnapshot(input.browserSnapshot,bot.config.market.id,bot.config.interval,Date.now()):null;
    const market = direct?.market ?? await resolveMarket(bot.config.market.id, env); if (!market) throw new TrainingError('A current market is required to resume or close.', 503);
    let snapshot;
    try {snapshot = direct ?? await spiderSnapshot(market, bot.config.interval);} catch {throw new TrainingError('A fresh live feed is required. The saved position has not changed.', 503);}
    if (!snapshotUsable(snapshot, Date.now())) throw new TrainingError('The market snapshot is stale. The saved position has not changed.', 503);
    next = advanceBot(bot, snapshot, Date.now(), match[2] as 'tick' | 'resume' | 'close');
  }
  if (!await repo.save(bot, next)) {
    if (match[2] === 'tick') return publicBot((await repo.find(owner, bot.id))!);
    throw new TrainingError('Another update was saved first. Refresh the spider and try again.', 409);
  }
  return publicBot(next);
}
export async function handleRunner(request: Request, env: SpiderEnvironment): Promise<Response> {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const key = env.SPIDER_RUNNER_KEY ?? '';
  let difference = supplied.length ^ key.length;
  for (let i = 0; i < key.length; i++) difference |= key.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  if (request.method !== 'POST' || key.length < 32 || difference !== 0 || !env.DB) return new Response('Not found.', {status: 404});
  const repo = new SpiderRepository(env.DB), bots = await repo.running();
  const results = await Promise.all(bots.map(async bot => {const next = await runSpider(bot, env); return repo.save(bot, next);}));
  return Response.json({checked: bots.length, saved: results.filter(Boolean).length}, {headers: {'Cache-Control': 'no-store'}});
}
