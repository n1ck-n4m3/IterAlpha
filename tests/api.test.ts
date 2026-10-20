import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../lib/server/api.ts';
import {coachFeedback,validateCoach} from '../lib/server/coach.ts';
import {createSession,advanceSession} from '../lib/training/engine.ts';
import {generatedSceneId,getScene,scenes} from '../lib/server/scenes.ts';
import {HistoricalSnapshotAdapter} from '../lib/server/market-data.ts';
import {parseCoinbaseCandles} from '../lib/server/live-market.ts';
import {syntheticMarketSnapshot} from '../lib/server/synthetic-market.ts';

function database(){
  const sql=new DatabaseSync(':memory:');
  const migrations=readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
  assert(migrations.length>0,'Generate the database migration before running API tests.');
  for(const name of migrations)sql.exec(readFileSync(`drizzle/${name}`,'utf8'));
  return {prepare(query:string){let params:unknown[]=[];const statement=sql.prepare(query);const adapter={bind(...values:unknown[]){params=values;return adapter;},async first(){return statement.get(...params as any[])??null;},async all(){return {results:statement.all(...params as any[])};},async run(){const result=statement.run(...params as any[]);return {meta:{changes:Number(result.changes)}};}};return adapter;}} as unknown as D1Database;
}
async function browser(db:D1Database){
  const response=await handleApi(new Request('http://localhost/api/bootstrap'),{DB:db});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  return async(path:string,body?:unknown,extra:Record<string,string>={})=>{
    const request=new Request(`http://localhost${path}`,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost','content-type':'application/json','x-iteralpha-request':'1',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const response=await handleApi(request,{DB:db});return {status:response.status,data:await response.json() as any};
  };
}

test('persistent API enforces ownership, hidden future and refresh recovery',async()=>{
  const db=database();const first=await browser(db);const second=await browser(db);const id=crypto.randomUUID();
  let result=await first('/api/sessions',{sceneId:'btc-pullback',requestId:id});assert.equal(result.status,201);assert.equal(result.data.candles.length,64);
  assert.equal((await second(`/api/sessions/${id}`)).status,404);
  assert.equal((await first(`/api/sessions/${id}?cursor=999`)).data.candles.length,64);
  const body={action:'wait',version:0,requestId:crypto.randomUUID()};result=await first(`/api/sessions/${id}/decisions`,body);assert.equal(result.status,200);assert.equal(result.data.candles.length,72);
  assert.equal((await first(`/api/sessions/${id}/decisions`,body)).data.decisions.length,1);
  assert.equal((await first(`/api/sessions/${id}/decisions`,{...body,action:'buy'})).status,409);
  assert.equal((await first('/api/bootstrap')).data.active.version,1);
  assert.equal((await second('/api/history')).data.length,0);
  assert.equal((await second(`/api/sessions/${id}/coach`)).status,404);
});
test('Play generates a fresh reconstructable scene with chosen capital and checkpoint pace',async()=>{
  const visit=await browser(database());
  const firstId=crypto.randomUUID();const secondId=crypto.randomUUID();
  const first=await visit('/api/sessions',{requestId:firstId,asset:'BTC',paceHours:4,initialCash:25_000});
  const second=await visit('/api/sessions',{requestId:secondId,asset:'BTC',paceHours:4,initialCash:25_000});
  assert.equal(first.status,201);assert.equal(second.status,201);
  assert.notEqual(first.data.scene.id,second.data.scene.id);
  assert.equal(first.data.scene.id,generatedSceneId(firstId,'BTC',4));
  assert.deepEqual(getScene(first.data.scene.id)?.candles.slice(0,64),first.data.candles);
  assert.equal(first.data.account.initialCash,25_000);assert.equal(first.data.account.cash,25_000);
  assert.equal(first.data.decisionTimes[1]-first.data.decisionTimes[0],4*3600);
  assert.equal((await visit('/api/sessions',{requestId:firstId,asset:'BTC',paceHours:4,initialCash:25_000})).status,200);
  assert.equal((await visit('/api/sessions',{requestId:firstId,asset:'BTC',paceHours:4,initialCash:10_000})).status,409);
  let current=first.data;
  assert.equal(first.data.nodeCount,6);
  for(let i=0;i<first.data.nodeCount;i++){const result=await visit(`/api/sessions/${firstId}/decisions`,{action:'wait',version:i,requestId:crypto.randomUUID()});assert.equal(result.status,200);current=result.data;}
  assert.equal(current.status,'completed');assert.equal(current.account.cash,25_000);assert.equal(current.outcome.netPnl,0);assert.equal(current.outcome.returnPercent,0);
});
test('advanced practice persists without requiring typed reasoning',async()=>{
  const visit=await browser(database());const id=crypto.randomUUID();
  const start=await visit('/api/sessions',{requestId:id,track:'advanced',paceHours:4});
  assert.equal(start.status,201);assert.equal(start.data.track,'advanced');assert.equal(start.data.nodeCount,8);
  assert.equal((await visit(`/api/sessions/${id}`)).data.track,'advanced');
  assert.equal((await visit('/api/sessions',{requestId:id,track:'foundations',paceHours:4})).status,409);
  assert.equal((await visit(`/api/sessions/${id}/decisions`,{action:'wait',version:0,requestId:crypto.randomUUID()})).status,200);
  const input={action:'wait',version:1,requestId:crypto.randomUUID(),reason:'Need confirmation'};
  const decision=await visit(`/api/sessions/${id}/decisions`,input);
  assert.equal(decision.status,200);assert.equal(decision.data.decisions[1].input.reason,input.reason);
});
test('step coach gives a saved-decision cue without an AI key',async()=>{
  const visit=await browser(database());const id=crypto.randomUUID();
  assert.equal((await visit('/api/sessions',{requestId:id,track:'foundations'})).status,201);
  assert.equal((await visit(`/api/sessions/${id}/step-coach`)).status,409);
  assert.equal((await visit(`/api/sessions/${id}/decisions`,{action:'wait',version:0,requestId:crypto.randomUUID()})).status,200);
  const reply=await visit(`/api/sessions/${id}/step-coach`,{requestId:crypto.randomUUID()});
  assert.equal(reply.status,200);assert.equal(reply.data.mode,'rules');assert.match(reply.data.takeaway,/Waiting/);
  assert.equal((await visit(`/api/sessions/${id}/step-coach`)).data.mode,'rules');
});
test('fifteen-minute rounds reveal only one new candle at each decision',async()=>{
  const visit=await browser(database());const id=crypto.randomUUID();
  const start=await visit('/api/sessions',{requestId:id,paceHours:0.25});
  assert.equal(start.status,201);assert.equal(start.data.nodeCount,6);
  assert.equal(start.data.decisionTimes[1]-start.data.decisionTimes[0],900);
  assert.equal(start.data.candles.length,64);
  const next=await visit(`/api/sessions/${id}/decisions`,{action:'wait',version:0,requestId:crypto.randomUUID()});
  assert.equal(next.status,200);assert.equal(next.data.candles.length,65);
  assert.ok(next.data.context.some((item:{id:string})=>item.id.startsWith('range-')));
  assert.ok(next.data.context.some((item:{id:string})=>item.id.startsWith('volume-')));
});
test('early access requires consent and saves a normalized email once',async()=>{
  const db=database();const visit=await browser(db);
  const payload={email:' Trader@Example.com ',track:'foundations',source:'home',consent:true};
  assert.equal((await visit('/api/early-access',{...payload,consent:false})).status,400);
  assert.equal((await visit('/api/early-access',payload)).status,201);
  assert.equal((await visit('/api/early-access',{...payload,email:'trader@example.com',track:'advanced'})).status,201);
  const row=await db.prepare('SELECT email, track, source FROM early_access_signups WHERE email = ?').bind('trader@example.com').first() as {email:string;track:string;source:string};
  assert.deepEqual({...row},{email:'trader@example.com',track:'advanced',source:'home'});
});
test('Coinbase candle parser keeps valid chronological OHLC bars only',()=>{
  assert.deepEqual(parseCoinbaseCandles([[2000,90,110,100,105,12],[1000,80,100,90,95,8],[3000,90,80,85,88,5],['bad',1,2,1,2,1]]).map(c=>c.time),[1000,2000]);
});
test('public market endpoint serves only deterministic synthetic samples',async()=>{
  const now=Date.parse('2026-10-20T19:34:00Z');
  const first=syntheticMarketSnapshot('BTC',now);
  assert.equal(first.mode,'synthetic');
  assert.equal(first.chart.length,192);
  assert.deepEqual(first,syntheticMarketSnapshot('BTC',now));
  assert(first.chart.every(c=>c.low<=Math.min(c.open,c.close)&&c.high>=Math.max(c.open,c.close)));
  const response=await handleApi(new Request('http://localhost/api/market?symbol=ETH'),{});
  assert.equal(response.status,200);
  const body=await response.json() as {mode:string;source:string;selected:string;chart:unknown[]};
  assert.equal(body.mode,'synthetic');
  assert.equal(body.selected,'ETH');
  assert.equal(body.chart.length,192);
  assert.match(body.source,/Synthetic/);
});
test('simultaneous submissions commit exactly one version',async()=>{
  const db=database();const visit=await browser(db);const id=crypto.randomUUID();await visit('/api/sessions',{sceneId:'eth-boundary',requestId:id});
  const responses=await Promise.all([visit(`/api/sessions/${id}/decisions`,{action:'wait',version:0,requestId:crypto.randomUUID()}),visit(`/api/sessions/${id}/decisions`,{action:'wait',version:0,requestId:crypto.randomUUID()})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await visit(`/api/sessions/${id}`)).data.decisions.length,1);
});
test('complete round, cached coach, quota, history and progress work without AI',async()=>{
  const visit=await browser(database());const id=crypto.randomUUID();await visit('/api/sessions',{sceneId:'btc-pullback',requestId:id});
  assert.equal((await visit(`/api/sessions/${id}/coach`,{requestId:crypto.randomUUID()})).status,409);
  for(let version=0;version<3;version++)assert.equal((await visit(`/api/sessions/${id}/decisions`,{action:'wait',version,requestId:crypto.randomUUID()})).status,200);
  const result=await visit(`/api/sessions/${id}`);assert.equal(result.data.status,'completed');assert.equal(result.data.candles.length,88);
  const reply=await visit(`/api/sessions/${id}/coach`,{requestId:crypto.randomUUID()});assert.equal(reply.data.mode,'rules');assert.match(reply.data.status,/not configured/);
  const cached=await visit(`/api/sessions/${id}/coach`,{requestId:crypto.randomUUID()});assert.equal(cached.data.createdAt,reply.data.createdAt);
  for(let i=0;i<3;i++)assert.equal((await visit(`/api/sessions/${id}/coach`,{requestId:crypto.randomUUID(),question:'What could I improve?'})).status,200);
  assert.equal((await visit(`/api/sessions/${id}/coach`,{requestId:crypto.randomUUID(),question:'More'})).status,429);
  assert.equal((await visit('/api/progress')).data.uniqueScenes,1);assert.equal((await visit('/api/history')).data[0].status,'completed');
});
test('cross-origin, invalid input, unavailable storage and oversized requests fail clearly',async()=>{
  const visit=await browser(database());assert.equal((await visit('/api/sessions',{sceneId:'btc-pullback',requestId:crypto.randomUUID()},{origin:'https://attacker.invalid'})).status,403);
  assert.equal((await visit('/api/sessions',{sceneId:'btc-pullback',requestId:'not-a-uuid'})).status,400);
  assert.equal((await visit('/api/sessions',{large:'x'.repeat(5000)})).status,413);
  assert.equal((await handleApi(new Request('http://localhost/api/bootstrap'),{})).status,503);
});
test('AI rejects invented citations and unverified numbers; provider failure falls back',async()=>{
  const valid={takeaway:'Define a loss before entering.',process_observation:'You recorded a stop.',next_drill_reason:'Try another range.',evidence_ids:['outcome']};
  assert.equal(validateCoach(valid,new Set(['outcome'])).takeaway,valid.takeaway);
  assert.throws(()=>validateCoach({...valid,evidence_ids:['invented']},new Set(['outcome'])));
  assert.throws(()=>validateCoach({...valid,takeaway:'You made $500.'},new Set(['outcome'])));
  let session=createSession(scenes[0],'owner','ai',new Date().toISOString());for(let i=0;i<3;i++)session=advanceSession(session,scenes[0],{action:'wait',version:i,requestId:crypto.randomUUID()},new Date().toISOString());
  const fail=async()=>{throw new Error('timeout');};const response=await coachFeedback(session,scenes[0],[],'',{key:'test',model:'test'},fail as typeof fetch);assert.equal(response.mode,'rules');assert.match(response.status,/unavailable/);
  const fake=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(valid)}]}]}),{status:200});
  const success=await coachFeedback(session,scenes[0],[],'',{key:'test',model:'test'},fake as typeof fetch);assert.equal(success.mode,'ai');
});
test('historical adapter rejects missing bars, false rights claims and invented OHLC geometry',()=>{
  const snapshot={sceneId:'btc-pullback',editorReviewed:true,displayRightsConfirmed:true,source:{mode:'historical',provider:'Test fixture',venue:'Test venue',symbol:'BTC-USD',intervalSeconds:900,retrievedAt:'2026-10-10T00:00:00Z',version:'test-v1',license:'Explicit display authorization recorded for testing only.',sourceUrl:'https://example.com/data',hash:'a'.repeat(64)},candles:structuredClone(scenes[0].candles)};
  const adapter=new HistoricalSnapshotAdapter();assert.equal(adapter.read(snapshot).candles.length,88);
  assert.throws(()=>adapter.read({...snapshot,displayRightsConfirmed:false}));
  const missing=structuredClone(snapshot);missing.candles[4].time+=900;assert.throws(()=>adapter.read(missing));
  const bad=structuredClone(snapshot);bad.candles[0].high=1;assert.throws(()=>adapter.read(bad));
  const item={id:'source-1',kind:'fact',title:'Published notice',text:'A verified notice was published.',source:'Official publisher',sourceUrl:'https://example.com/notice',publishedAt:'2024-04-08T12:00:00Z',availableAt:'2024-04-08T12:15:00Z',provenance:'Publisher timestamp checked against an archived copy.'};
  assert.equal(adapter.read({...snapshot,evidence:[item]}).evidence?.length,1);
  assert.throws(()=>adapter.read({...snapshot,evidence:[{...item,availableAt:'2024-04-08T11:59:00Z'}]}));
  assert.throws(()=>adapter.read({...snapshot,evidence:[item,item]}));
});
