import {writeFileSync} from 'node:fs';

const levels=['first-time','beginner','intermediate','experienced'];
const tasks=['read-chart','size-a-trade','manage-risk','review-a-decision','compare-evidence'];
const locales=['en','zh-CN','es','ja','ar'];
const personas=[];
for(const level of levels)for(const task of tasks)for(const locale of locales){
  const index=personas.length;
  const device=index%2===0?'mobile':'desktop';
  const friction=[];
  if(locale!=='en')friction.push('Scene evidence and coach prose remain in English.');
  if(task==='read-chart'&&level==='first-time')friction.push('A first-time user needs a short chart lesson before interpreting indicators.');
  if(task==='read-chart'&&level==='experienced')friction.push('Fixed MA periods limit personalized chart analysis.');
  if(task==='compare-evidence'&&level==='experienced')friction.push('Synthetic evidence cannot replace timestamped historical sources.');
  if(task==='review-a-decision'&&level==='experienced')friction.push('Rule feedback is less adaptive than a configured AI coach.');
  if(device==='mobile'&&task==='read-chart')friction.push('A dense chart and evidence bubbles need a narrow-screen visual check.');
  personas.push({id:index+1,level,task,locale,device,friction});
}
if(personas.length!==100)throw new Error('The audit must cover exactly 100 synthetic personas.');
writeFileSync(new URL('../docs/persona-audit.json',import.meta.url),JSON.stringify({method:'Synthetic combinatorial heuristic review; no human participants or measured usability outcomes.',personas},null,2)+'\n');
const counts=Object.fromEntries([...new Set(personas.flatMap(persona=>persona.friction))].map(issue=>[issue,personas.filter(persona=>persona.friction.includes(issue)).length]));
process.stdout.write(JSON.stringify({personas:personas.length,counts},null,2)+'\n');
