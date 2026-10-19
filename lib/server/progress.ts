import { evaluate } from '../training/engine.ts';
import type { HistoryItem, ProgressView, Session } from '../training/types.ts';
import { getScene } from './scenes.ts';

export function history(sessions: Session[]): HistoryItem[] {
  return sessions.map(s=>{const scene=getScene(s.sceneId)!;return {id:s.id,sceneId:s.sceneId,title:scene.title,asset:scene.asset,topic:scene.topic,status:s.status,decisions:s.decisions.length,netPnl:evaluate(s,scene).netPnl,mode:scene.mode,updatedAt:s.updatedAt};});
}
export function progress(sessions: Session[]): ProgressView {
  const completed = sessions.filter(s=>s.status==='completed');
  const unique = new Set(completed.map(s=>s.sceneId));
  const independent = completed.filter((s,i,a)=>a.findIndex(x=>x.sceneId===s.sceneId)===i);
  const waited = independent.filter(s=>s.decisions.every(d=>d.input.action==='wait')).length;
  const gaps = independent.filter(s=>s.decisions.some(d=>d.input.riskPercent!==undefined&&d.actualEntryRisk>d.equityBefore*d.input.riskPercent/100+0.01)).length;
  const observations = [{title: unique.size<3?'Still getting to know your decisions':'A small sample, not a skill score',detail:`${unique.size} distinct scene(s) completed. Repeat attempts do not count as new evidence of ability.`}];
  if (waited>=3) observations.push({title:'A recurring choice to wait',detail:`You stayed in cash in ${waited} of ${independent.length} distinct completed scenes. This records a choice; it does not diagnose hesitation or reward it as correct.`});
  if (gaps>=3) observations.push({title:'Execution risk deserves another look',detail:`Entry risk exceeded the chosen budget in ${gaps} of ${independent.length} distinct scenes. Practise checking how next-open gaps affect a committed quantity.`});
  return {completed:completed.length,uniqueScenes:unique.size,decisions:sessions.reduce((sum,s)=>sum+s.decisions.length,0),returns:completed.reduce((sum,s)=>sum+evaluate(s,getScene(s.sceneId)!).netPnl,0),fees:completed.reduce((sum,s)=>sum+evaluate(s,getScene(s.sceneId)!).fees,0),
    topics:(['trend','range','event'] as const).map(topic=>({topic,completed:completed.filter(s=>getScene(s.sceneId)?.topic===topic).length,total:completed.length})),
    observations,recent:history(sessions).slice(0,6),nextSceneId:null};
}
