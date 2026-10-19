import type { Candle, Evidence, Scene, SceneSummary, Session, Topic } from '../training/types.ts';
import snapshots from '../../data/historical-snapshots.json' with { type: 'json' };
import { HistoricalSnapshotAdapter } from './market-data.ts';
import { TrainingError, sessionView } from '../training/engine.ts';

// This module is imported only by server code. Future prices never enter client bundles.
function generateCandles(seed: number, base: number, topic: Topic, start: number, count = 88): Candle[] {
  let state = seed >>> 0; let close = base;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const prior = close;
    const drift = topic === 'trend' ? (i < 48 ? 0.001 : i < 64 ? -0.0006 : (seed % 2 ? 0.00065 : -0.0008)) : topic === 'range' ? (base - close) / base * 0.09 : (i >= 64 ? (seed % 2 ? -0.0005 : 0.0005) : 0.0001);
    const volatility = topic === 'event' ? 0.008 : 0.0038;
    const open = prior * (1 + (i === 72 && topic === 'event' ? -0.003 : (random() - 0.5) * 0.0005));
    close = open * (1 + drift + (random() - 0.5) * volatility);
    const wick = volatility * (0.15 + random() * 0.45);
    candles.push({ time: start + i * 900, open: +open.toFixed(2), high: +(Math.max(open, close) * (1 + wick)).toFixed(2), low: +(Math.min(open, close) * (1 - wick * (0.5 + random()))).toFixed(2), close: +close.toFixed(2), volume: Math.round(150 + random() * 950) });
  }
  return candles;
}
const definitions: {id: string; asset: 'BTC' | 'ETH'; title: string; subtitle: string; topic: Topic; seed: number; base: number; start: string; objective: string; inference: string; uncertainty: string; context?: Evidence}[] = [
  {id: 'btc-pullback', asset:'BTC', title:'The pullback', subtitle:'An advancing market pauses.', topic:'trend', seed:421, base:64200, start:'2024-04-08T00:00:00Z', objective:'Define a loss before taking a position.', inference:'A pause after an advance can offer a new decision point. It does not establish that the trend will continue.', uncertainty:'There is no confirmed catalyst in this scene. Decide what would invalidate your entry.'},
  {id:'eth-boundary', asset:'ETH', title:'At the boundary', subtitle:'Price meets a familiar range.', topic:'range', seed:842, base:3240, start:'2024-04-09T00:00:00Z', objective:'Separate a price level from a reason to act.', inference:'Repeated visits to a range boundary can lead to either rejection or a break. The visible chart alone cannot settle which.', uncertainty:'A level is a reference, not a guarantee. How much confirmation do you need?'},
  {id:'btc-announcement', asset:'BTC', title:'After the announcement', subtitle:'A policy headline enters the picture.', topic:'event', seed:963, base:66600, start:'2024-03-20T03:00:00Z', objective:'Separate a verified headline from a directional prediction.', inference:'An unchanged policy rate does not tell you how much the market had already anticipated.', uncertainty:'The price tape is simulated. It cannot establish how Bitcoin actually responded to this announcement.', context:{id:'fed-march-2024',kind:'fact',title:'Policy held steady',text:'The Federal Reserve held its target range at 5.25%–5.50%. This is real historical context alongside a simulated price path.',source:'Federal Reserve · March 20 statement',sourceUrl:'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240320a.htm',publishedAt:'2024-03-20T18:00:00Z',availableAt:'2024-03-20T18:00:00Z',provenance:'Dated official release; retrieved 2026-10-10. Paraphrased rate decision only.'}},
  {id:'eth-pullback', asset:'ETH', title:'A second entry point', subtitle:'A move higher loses momentum.',topic:'trend',seed:628,base:3470,start:'2024-05-06T00:00:00Z',objective:'Reassess the evidence at each decision point.',inference:'The recent direction is visible, but a pullback can become a larger change. A smaller position does not make an unsupported thesis correct.',uncertainty:'No additional fundamental evidence is included. Your stop should express the boundary of your thesis.'},
  {id:'btc-boundary',asset:'BTC',title:'Room to move',subtitle:'A narrow range tests your patience.',topic:'range',seed:735,base:61100,start:'2024-05-07T00:00:00Z',objective:'Treat waiting as a choice with a reason.',inference:'A compact range can make the cost of a stop easier to define, but fees become more important relative to small moves.',uncertainty:'A quiet interval does not predict a breakout. The next segment has not been revealed.'},
  {id:'eth-announcement',asset:'ETH',title:'A new policy backdrop',subtitle:'A rate decision changes the context.',topic:'event',seed:486,base:2370,start:'2024-09-18T03:00:00Z',objective:'Keep event interpretation separate from position size.',inference:'A rate cut may change expectations, but it does not supply a reliable direction for the next few candles.',uncertainty:'The price tape is simulated. It is not evidence of Ether’s historical reaction to the statement.',context:{id:'fed-september-2024',kind:'fact',title:'A lower policy range',text:'The Federal Reserve lowered its target range by 0.50 percentage points to 4.75%–5.00%. The accompanying chart is simulated.',source:'Federal Reserve · September 18 statement',sourceUrl:'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm',publishedAt:'2024-09-18T18:00:00Z',availableAt:'2024-09-18T18:00:00Z',provenance:'Dated official release; retrieved 2026-10-10. Paraphrased rate decision only.'}}
];
const demoScenes: Scene[] = definitions.map(d => ({...d, difficulty: d.topic === 'event' ? 'Intermediate' : 'Foundations', minutes: 4, mode:'synthetic', version:'scene-v1', source:{mode:'synthetic',provider:'IterAlpha authored simulation',venue:'No exchange',symbol:`${d.asset}-USD`,intervalSeconds:900,retrievedAt:'2026-10-10T00:00:00Z',version:`synthetic-v1-${d.seed}`,license:'Original teaching data. Generated deterministically; not historical market prices or volumes.'},candles:generateCandles(d.seed,d.base,d.topic,Date.parse(d.start)/1000),nodes:[63,71,79],end:87}));
const snapshotAdapter = new HistoricalSnapshotAdapter();
export const scenes: Scene[] = demoScenes.map(scene => {
  const candidate = snapshots.find((item: {sceneId: string}) => item.sceneId === scene.id);
  if (!candidate) return scene;
  const snapshot = snapshotAdapter.read(candidate);
  if (snapshot.source.symbol !== `${scene.asset}-USD`) throw new Error('Snapshot symbol mismatch.');
  const cutoff = (snapshot.candles[scene.nodes[0]].time + 900) * 1000;
  const context = scene.context && Date.parse(scene.context.availableAt) <= cutoff ? {...scene.context, text: scene.context.text.replace('This is real historical context alongside a simulated price path.', 'This release provides historical context, not proof of causation.').replace('The accompanying chart is simulated.', 'Price data are from the stated venue.')} : undefined;
  return {...scene, mode:'historical', version:`scene-v1-${snapshot.source.version}`, source:snapshot.source, candles:snapshot.candles, context, uncertainty:scene.topic === 'event' ? 'The statement does not establish what expectations were already priced in or what caused the subsequent price path.' : scene.uncertainty};
});
export function generatedSceneId(requestId: string, asset: 'BTC' | 'ETH' | 'random' = 'random', paceHours: 1 | 4 = 1) {
  const hex = requestId.replaceAll('-', '').slice(0, 8).toLowerCase();
  const seed = Number.parseInt(hex, 16);
  const chosenAsset = asset === 'random' ? seed % 2 ? 'BTC' : 'ETH' : asset;
  const topic: Topic = (['trend', 'range', 'event'] as const)[seed % 3];
  return `play-${chosenAsset.toLowerCase()}-${topic}-${paceHours}h-${hex}`;
}
function generatedScene(id: string): Scene | undefined {
  const match = /^play-(btc|eth)-(trend|range|event)-(1|4)h-([0-9a-f]{8})$/.exec(id);
  if (!match) return undefined;
  const asset = match[1].toUpperCase() as 'BTC' | 'ETH';
  const topic = match[2] as Topic;
  const paceHours = Number(match[3]);
  const seed = Number.parseInt(match[4], 16);
  const step = paceHours * 4;
  const nodes = [63, 63 + step, 63 + 2 * step];
  const end = 63 + 3 * step;
  const base = (asset === 'BTC' ? 60_000 : 3_000) * (0.8 + (seed % 4001) / 10_000);
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000 + (seed % 180) * 86_400;
  const title = topic === 'trend' ? 'Trend decision' : topic === 'range' ? 'Range decision' : 'Volatility decision';
  const inference = topic === 'trend' ? 'Recent direction is visible, but it does not establish that the next move will continue.' : topic === 'range' ? 'A visible boundary may hold or break; neither outcome is guaranteed.' : 'A wider price range makes both opportunity and execution uncertainty larger.';
  return {id, asset, topic, title, subtitle:`Fresh ${asset} spot practice · ${paceHours}h checkpoints`, difficulty:'Adaptive practice', objective:'Choose an amount, preserve cash for later decisions, and explain the condition that would change your view.', minutes:4, mode:'synthetic', version:'generated-v1', source:{mode:'synthetic',provider:'IterAlpha authored simulation',venue:'No exchange',symbol:`${asset}-USD`,intervalSeconds:900,retrievedAt:'2026-10-11T00:00:00Z',version:`generated-v1-${seed}-${topic}-${paceHours}`,license:'Deterministic teaching data. These are not historical prices, volumes, or live quotes.'}, candles:generateCandles(seed,base,topic,start,end+1),nodes,end,inference,uncertainty:'Only the revealed synthetic candles are known. The next segment has not been shown.'};
}
export function getScene(id: string): Scene | undefined { return scenes.find(s => s.id === id) ?? generatedScene(id); }
export function summaries(): SceneSummary[] { return scenes.map(({id,title,subtitle,asset,topic,difficulty,objective,minutes,mode})=>({id,title,subtitle,asset,topic,difficulty,objective,minutes,mode})); }
export function evidenceAt(scene: Scene, cursor: number): Evidence[] {
  const current = scene.candles[cursor]; const past = scene.candles[Math.max(0,cursor-16)];
  const change = (current.close / past.close - 1) * 100;
  const cutoff = new Date((current.time + scene.source.intervalSeconds)*1000).toISOString();
  const fact: Evidence = scene.context && Date.parse(scene.context.availableAt) <= Date.parse(cutoff) ? scene.context : {id:`price-${cursor}`,kind:'fact',title:'The visible price path',text:`The last close is $${current.close.toFixed(2)}, ${change>=0?'up':'down'} ${Math.abs(change).toFixed(2)}% from 16 candles earlier. ${scene.mode === 'synthetic' ? 'These are simulated prices.' : 'Historical prices from the stated venue.'}`,source:'Visible candles · calculated',publishedAt:cutoff,availableAt:cutoff,provenance:`${scene.source.version}; close-to-close change using only visible candles.`};
  return [fact,{id:`inference-${cursor}`,kind:'inference',title:'One interpretation',text:scene.inference,source:'IterAlpha teaching note',publishedAt:cutoff,availableAt:cutoff,provenance:'Authored interpretation, not a historical fact or a prediction.'},{id:`unknown-${cursor}`,kind:'unknown',title:'What remains uncertain',text:scene.uncertainty,source:'Scene boundary',publishedAt:cutoff,availableAt:cutoff,provenance:'Explicit limitation of the available information.'}];
}
export function view(session: Session) { const scene = getScene(session.sceneId); if (!scene) throw new Error('Scene not found.'); if (session.sceneVersion !== scene.version || session.dataVersion !== scene.source.version) throw new TrainingError('The scene data changed. Start a new round.', 409); return sessionView(session,scene,evidenceAt(scene,session.cursor)); }
