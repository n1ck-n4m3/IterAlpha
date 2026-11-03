'use client';
import LocalizedContent from './localized-content';



import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,Radio,ShieldCheck,Wallet} from 'lucide-react';
import {LANDING_COPY} from '../lib/landing-copy';
import CyberSpider from './cyber-spider';
const C=LANDING_COPY.agentPreview;
export default function AgentPreview({motion}:{motion:boolean}){
  const [stage,setStage]=useState(0);
  useEffect(()=>{if(!motion||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=setInterval(()=>{if(!document.hidden)setStage(s=>(s+1)%4);},2300);return()=>clearInterval(timer);},[motion]);
  return <LocalizedContent>{<div className="agent-preview" id="demo"><div className="ap-heading"><span><i/>{C.label}</span><span>0{stage+1} / 04</span></div><h2>{C.title}</h2><div className="ap-orbit-scene" aria-hidden="true"><div className="ap-ring ring-one"/><div className="ap-ring ring-two"/><div className="ap-grid"/><span className={`ap-satellite ap-market ${stage===0?'active':''}`}><Radio size={23}/></span><span className={`ap-satellite ap-guard ${stage===2?'active':''}`}><ShieldCheck size={23}/></span><span className={`ap-satellite ap-wallet ${stage===3?'active':''}`}><Wallet size={23}/></span><div className={`ap-spider stage-${stage}`}><CyberSpider active stage={stage}/></div></div><div className="ap-stages">{C.stages.map((label,i)=><button key={label} className={stage===i?'active':''} aria-pressed={stage===i} onClick={()=>setStage(i)}><span>{i<stage?<Check size={10}/>:i+1}</span>{label}</button>)}</div><p className="ap-detail">{C.details[stage]}</p><div className="ap-foot"><small>{C.note}</small><a href="/app?view=spider&mode=easy">{C.cta}<ArrowUpRight size={13}/></a></div></div>}</LocalizedContent>;
}
