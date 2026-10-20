import { z } from 'zod';
import { TrainingError, advanceSession, createSession, RULES } from '../training/engine.ts';
import { Repository } from './repository.ts';
import { generatedSceneId, getScene, summaries, view } from './scenes.ts';
import { history, progress } from './progress.ts';
import { coachFeedback, ruleFeedback, ruleStepFeedback, stepCoachFeedback } from './coach.ts';
import { marketAssets, syntheticMarketSnapshot } from './synthetic-market.ts';

interface ApiEnvironment { DB?: D1Database; OPENAI_API_KEY?: string; OPENAI_MODEL?: string }
const decisionSchema = z.object({action:z.enum(['buy','wait','hold','halve','sell']),riskPercent:z.number().finite().optional(),amountUsd:z.number().finite().optional(),sellPercent:z.number().finite().min(1).max(100).optional(),stopPrice:z.number().finite().optional(),reason:z.enum(['Price structure','Defined risk','Need confirmation','Event uncertainty']).optional(),thesis:z.string().trim().max(300).optional(),version:z.number().int().min(0).max(8),requestId:z.string().uuid()}).strict();
const startSchema = z.object({sceneId:z.string().max(80).optional(),asset:z.enum(['BTC','ETH','random']).optional(),paceHours:z.union([z.literal(0.25),z.literal(1),z.literal(4)]).optional(),initialCash:z.number().int().min(100).max(1_000_000).optional(),track:z.enum(['foundations','advanced']).optional(),requestId:z.string().uuid()}).strict();
const coachSchema = z.object({requestId:z.string().uuid(),question:z.string().trim().max(300).default('')}).strict();
const stepCoachSchema=z.object({requestId:z.string().uuid()}).strict();
const signupSchema = z.object({email:z.string().trim().email().max(254),track:z.enum(['foundations','advanced','undecided']),source:z.enum(['home','foundations','advanced']),consent:z.literal(true),website:z.string().max(100).optional()}).strict();
function identity(request: Request) {
  const signedIn = request.headers.get('oai-authenticated-user-id');
  if (signedIn) return {owner:`chatgpt:${signedIn}`,cookie:null};
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)iteralpha_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (token) return {owner:`guest:${token}`,cookie:null};
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  return {owner:`guest:${fresh}`,cookie:`iteralpha_guest=${fresh}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new TrainingError('JSON is required.',415);
  if (Number(request.headers.get('content-length')??0)>4096) throw new TrainingError('Request is too large.',413);
  const reader=request.body?.getReader(); if(!reader)throw new TrainingError('Request body is missing.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new TrainingError('Request is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new TrainingError('Invalid JSON.'); }
}
export async function handleApi(request: Request, env: ApiEnvironment): Promise<Response> {
  const user=identity(request);
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie, oai-authenticated-user-id'};
  if(user.cookie)headers['Set-Cookie']=user.cookie;
  const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
  try {
    const url=new URL(request.url);const path=url.pathname.replace(/\/$/,'');
    if (request.method==='POST') {
      const origin=request.headers.get('origin');
      if(request.headers.get('x-iteralpha-request')!=='1'||request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==url.origin)) throw new TrainingError('This request must come from the training application.',403);
    }
    if(path==='/api/health')return json({ok:true,storageConfigured:!!env.DB,aiConfigured:!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL,dataMode:summaries().some(scene=>scene.mode==='historical')?'mixed':'synthetic',version:'0.2.0'});
    if(path==='/api/market'&&request.method==='GET'){
      const selected=url.searchParams.get('symbol')??'BTC';
      if(!marketAssets.includes(selected as typeof marketAssets[number]))throw new TrainingError('Unsupported market symbol.',400);
      return json(syntheticMarketSnapshot(selected as typeof marketAssets[number]));
    }
    if(!env.DB)throw new TrainingError('Training storage is unavailable. Please try again shortly.',503);
    const repo=new Repository(env.DB);
    if(path==='/api/early-access'&&request.method==='POST'){
      const input=signupSchema.parse(await readBody(request));
      if(!input.website)await repo.signUp(input.email.toLowerCase(),input.track,input.source,new Date().toISOString());
      return json({ok:true,message:'You are on the early access list. Thank you for helping shape IterAlpha.'},201);
    }
    if(path==='/api/bootstrap'&&request.method==='GET'){
      const sessions=await repo.list(user.owner);const active=sessions.find(s=>s.status==='active');
      return json({scenes:summaries(),active:active?view(active):null,history:history(sessions),progress:progress(sessions),rules:RULES,aiConfigured:!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL,identity:user.owner.startsWith('chatgpt:')?'signed-in':'guest'});
    }
    if(path==='/api/sessions'&&request.method==='POST'){
      const input=startSchema.parse(await readBody(request));const sceneId=input.sceneId??generatedSceneId(input.requestId,input.asset,input.paceHours,input.track);const scene=getScene(sceneId);if(!scene)throw new TrainingError('Scene not found.',404);
      const existing=await repo.find(user.owner,input.requestId);if(existing&&existing.sceneId!==scene.id)throw new TrainingError('This request ID belongs to another scene.',409);
      if(existing&&input.initialCash!==undefined&&(existing.initialCash??RULES.initialCash)!==input.initialCash)throw new TrainingError('This request ID belongs to another starting balance.',409);
      if(existing&&input.track!==undefined&&(existing.track??'foundations')!==input.track)throw new TrainingError('This request ID belongs to another training track.',409);
      const session=existing??await repo.create(createSession(scene,user.owner,input.requestId,new Date().toISOString(),input.initialCash??RULES.initialCash,input.track??'foundations'));return json(view(session),existing?200:201);
    }
    if(path==='/api/history'&&request.method==='GET')return json(history(await repo.list(user.owner)));
    if(path==='/api/progress'&&request.method==='GET')return json(progress(await repo.list(user.owner)));
    const match=path.match(/^\/api\/sessions\/([0-9a-f-]{36})(?:\/(decisions|coach|step-coach))?$/);
    if(!match)throw new TrainingError('Not found.',404);
    const session=await repo.find(user.owner,match[1]);if(!session)throw new TrainingError('Session not found.',404);
    const scene=getScene(session.sceneId)!;
    if(request.method==='GET'&&!match[2])return json(view(session));
    if(match[2]==='decisions'&&request.method==='POST'){
      const input=decisionSchema.parse(await readBody(request));const next=advanceSession(session,scene,input,new Date().toISOString());
      if(!await repo.save(session,next)){
        const current=await repo.find(user.owner,session.id);
        if(current?.decisions.some(d=>d.requestId===input.requestId))return json(view(advanceSession(current,scene,input,new Date().toISOString())));
        throw new TrainingError('Another decision was saved first. Refresh to continue.',409);
      }
      return json(view(next));
    }
    if(match[2]==='step-coach'&&(request.method==='GET'||request.method==='POST')){
      if(!session.decisions.length)throw new TrainingError('Save a decision before requesting a coach cue.',409);
      const key=`${session.id}:step:${session.version}`;
      const cached=await repo.coach(user.owner,session.id,key);
      if(cached?.response)return json(JSON.parse(cached.response));
      if(request.method==='GET')return json(ruleStepFeedback(session));
      stepCoachSchema.parse(await readBody(request));
      if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return json(ruleStepFeedback(session));
      if(cached){
        if(Date.now()-Date.parse(cached.created_at)<20000) return json(ruleStepFeedback(session,'AI coach is preparing feedback. Showing a rule-based cue for now.'));
        const fallback=ruleStepFeedback(session,'The earlier AI request was interrupted. Showing rule-based feedback.');
        await repo.finishCoach(user.owner,key,fallback);return json(fallback);
      }
      if(!await repo.reserveStepCoach(user.owner,session.id,key,new Date().toISOString()))return json(ruleStepFeedback(session,'Coach limit reached. Showing rule-based feedback.'));
      const reply=await stepCoachFeedback(session,scene,{key:env.OPENAI_API_KEY,model:env.OPENAI_MODEL});
      await repo.finishCoach(user.owner,key,reply);return json(reply);
    }
    if(match[2]==='coach'&&request.method==='GET')return json(await repo.coaching(user.owner,session.id));
    if(match[2]==='coach'&&request.method==='POST'){
      if(session.status!=='completed')throw new TrainingError('Finish the round before requesting a review.',409);
      const input=coachSchema.parse(await readBody(request));
      // The initial review has one durable key, even after reload or a network retry.
      const key=input.question?`${session.id}:${input.requestId}`:`${session.id}:review`;
      const cached=await repo.coach(user.owner,session.id,key);
      if(cached){
        if(cached.question!==input.question)throw new TrainingError('This request ID was already used for another question.',409);
        if(cached.response)return json(JSON.parse(cached.response));
        if(Date.now()-Date.parse(cached.created_at)<20000)return json({error:'A review is already in progress. Try again shortly.'},409);
        const fallback=ruleFeedback(session,scene,input.question,'The earlier AI request was interrupted. Showing rule-based feedback.');
        await repo.finishCoach(user.owner,key,fallback);return json(fallback);
      }
      if(!await repo.reserveCoach(user.owner,session.id,key,input.question,new Date().toISOString()))throw new TrainingError('Coach limit reached: one review and three questions per round, twenty requests per day.',429);
      const reply=await coachFeedback(session,scene,await repo.list(user.owner),input.question,{key:env.OPENAI_API_KEY,model:env.OPENAI_MODEL});
      await repo.finishCoach(user.owner,key,reply);return json(reply);
    }
    throw new TrainingError('Method not allowed.',405);
  } catch(error) {
    if(error instanceof z.ZodError)return json({error:new URL(request.url).pathname==='/api/early-access'?'Enter a valid email and agree to the stated use.':'Some values are invalid. Check the starting balance, order amount, and stop price.'},400);
    if(error instanceof TrainingError)return json({error:error.message},error.status);
    // Avoid exposing provider responses, database details or secrets to visitors.
    return json({error:'The request could not be saved. Please retry; your previous progress is safe.'},503);
  }
}
