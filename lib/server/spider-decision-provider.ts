import type {BotView, Cycle} from '../spider/types.ts';
import {tradingJudgeRequest, validateTradingJudgment} from '../spider/decision-contract.ts';
import {DECISION_MODEL, DECISION_REVISION} from './decision-provider.ts';

export interface SpiderDecisionEnvironment {
  SPIDER_DECISION_MODE?:'off'|'shadow'; SPIDER_DECISION_URL?:string; SPIDER_DECISION_KEY?:string;
  SPIDER_DECISION_MODEL?:string; SPIDER_DECISION_REVISION?:string;
}
function configuration(env:SpiderDecisionEnvironment) {
  if(env.SPIDER_DECISION_MODE!=='shadow'||!env.SPIDER_DECISION_URL||(env.SPIDER_DECISION_KEY?.length??0)<24)return null;
  try {const url=new URL(env.SPIDER_DECISION_URL);
    if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return null;
    return {url:url.href,key:env.SPIDER_DECISION_KEY!,model:env.SPIDER_DECISION_MODEL??DECISION_MODEL,revision:env.SPIDER_DECISION_REVISION??DECISION_REVISION};
  }catch{return null;}
}
export function spiderCapabilities(env:SpiderDecisionEnvironment) {
  return {execution:'rule-strategy',model:configuration(env)?'shadow-configured':'not-connected',modelControlsOrders:false,
    judgeContract:'iteralpha-trading-judge-v1',trainingContract:'iteralpha-training-job-v1',trainingWorker:'not-configured',realOrders:false} as const;
}
async function boundedResponse(response:Response) {
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty judgment response.');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>16384){await reader.cancel();throw new Error('Judgment response is too large.');}chunks.push(item.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
// Intended for a private worker or offline evaluation, never the order execution path.
export async function shadowTradingJudgment(bot:BotView,cycle:Cycle,env:SpiderDecisionEnvironment,fetcher:typeof fetch=fetch) {
  const config=configuration(env);if(!config)return {status:'not-configured' as const};
  try {const request=tradingJudgeRequest(bot,cycle),started=Date.now();
    const response=await fetcher(config.url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify(request),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('The trading judge is unavailable.');
    return {status:'shadow' as const,checkTime:cycle.time,latencyMs:Date.now()-started,judgment:validateTradingJudgment(await boundedResponse(response),config)};
  }catch{return {status:'unavailable' as const};}
}
