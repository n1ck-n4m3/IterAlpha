'use client';
import {useEffect, useId, useState} from 'react';
import {Activity, ArrowDownRight, ArrowUpRight, Check, CirclePause, ScanLine, Shield, Zap} from 'lucide-react';
import type {BotView, Cycle, Snapshot} from '../lib/spider/types';
import {COCKPIT as C, PIPELINE, cockpitMode, cycleChecks, executionResult} from '../lib/spider/cockpit';
import {SPIDER} from '../lib/spider/copy';

const posts = [{x:210,y:58},{x:340,y:144},{x:210,y:230},{x:80,y:144}];
const colors = ['#60e7e1','#b99aff','#f391d2','#71f2ac'];
export function SpiderAvatar({compact = false}: {compact?: boolean}) {
  return <svg className={`cy-avatar ${compact ? 'compact' : ''}`} viewBox="-60 -50 120 100" aria-hidden="true"><g className="cy-spider-legs">{[-1,1].map(side => <g key={side} transform={`scale(${side} 1)`}>{[0,1,2,3].map(index => <path key={index} className={`leg-${index}`} d={`M10 ${-17+index*10} L${26+index*2} ${-36+index*22} L${48-index*3} ${-40+index*26}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>)}</g>)}</g><path d="M0 -5 C-21 -8 -23 21 0 32 C23 21 21 -8 0 -5" fill="currentColor" fillOpacity=".17" stroke="currentColor" strokeWidth="1.5"/><path d="M0 -23 C-14 -23 -15 -6 0 0 C15 -6 14 -23 0 -23" fill="currentColor"/><path d="M-4 9 L0 15 L4 9 M0 15 V23" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="-4" cy="-15" r="1.7" fill="#090812"/><circle cx="4" cy="-15" r="1.7" fill="#090812"/></svg>;
}
export default function SpiderArena({bot, snapshot, fresh, observing, motion, replay, onInspect}: {bot: BotView | null; snapshot: Snapshot | null; fresh: boolean; observing: boolean; motion: boolean; replay: Cycle | null; onInspect: () => void}) {
  const mode = cockpitMode(bot, fresh, replay), checks = cycleChecks(bot, replay), cycle = replay ?? bot?.cycles?.at(-1) ?? null;
  const id = useId().replaceAll(':',''), [stage, setStage] = useState(-1), [now, setNow] = useState(0);
  const recordedTime = cycle?.time ?? 0;
  useEffect(() => {setNow(Date.now()); if (mode !== 'live') return; const timer = setInterval(() => {if (!document.hidden) setNow(Date.now());}, motion ? 250 : 1000); return () => clearInterval(timer);}, [mode, motion]);
  useEffect(() => {
    if (!recordedTime || !motion || mode !== 'live' && mode !== 'replay') {setStage(-1); return;}
    const timers = PIPELINE.map((_, index) => setTimeout(() => setStage(index), index * 400));
    timers.push(setTimeout(() => setStage(-1), 1950)); return () => timers.forEach(clearTimeout);
  }, [recordedTime, motion, mode]);
  const active = stage >= 0 ? stage : observing && mode !== 'replay' && fresh ? 0 : -1;
  const location = active >= 0 ? posts[active] : {x:210,y:144}, action = executionResult(cycle);
  const remaining = mode === 'live' && bot?.lastEvaluationAt ? Math.max(0,(bot.lastEvaluationAt+(bot.config.evaluationSeconds??5)*1000-now)/1000) : null;
  const progress = bot?.tapeReading ? Math.min(1,bot.tapeReading.windowSeconds/30) : 0;
  const lastReason = mode === 'paused' ? bot?.events.at(-1)?.reason ?? 'paused' : mode === 'offline' ? 'feed-unavailable' : cycle?.reason;
  return <section className={`cy-arena cy-panel mode-${mode} ${active>=0 ? 'is-working' : ''}`} aria-label={C.arena}>
    <div className="cy-panel-head"><h2><span className="cy-led"/>{C.arena}</h2><span>{mode === 'replay' ? C.replay : C.rules} <i>01</i></span></div>
    {cycle&&cycle.action!=='hold'&&mode!=='paused'&&mode!=='offline'&&<span key={cycle.time} className={`cy-fill-flash ${cycle.action}`} aria-hidden="true"/>}
    <div className="cy-arena-status"><span className={`cy-status-pill ${mode}`}><i/>{C.mode[mode]}</span><span className="cy-eval-time">{C.cadence}<b>{bot?.config.evaluationSeconds??5}{C.seconds}</b></span></div>
    <div className="cy-stage-space" onPointerMove={event=>{if(!motion||event.pointerType==='touch')return;const box=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--tilt-x',`${((event.clientY-box.top)/box.height-.5)*-5}deg`);event.currentTarget.style.setProperty('--tilt-y',`${((event.clientX-box.left)/box.width-.5)*7}deg`);}} onPointerLeave={event=>{event.currentTarget.style.setProperty('--tilt-x','0deg');event.currentTarget.style.setProperty('--tilt-y','0deg');}}>
      <svg className="cy-network" viewBox="0 0 420 290" role="img" aria-label={`${C.mode[mode]} · ${lastReason ? C.reasons[lastReason] : C.noRecord}`}>
        <defs><radialGradient id={`arena-glow-${id}`}><stop stopColor="#9d58e7" stopOpacity=".23"/><stop offset="1" stopColor="#9d58e7" stopOpacity="0"/></radialGradient><linearGradient id={`arena-floor-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a67af2" stopOpacity=".08"/><stop offset="1" stopColor="#18142d" stopOpacity=".02"/></linearGradient></defs>
        <ellipse cx="210" cy="162" rx="190" ry="119" fill={`url(#arena-glow-${id})`}/>
        <path d="M210 18L400 144L210 270L20 144Z" className="cy-floor-outline" fill={`url(#arena-floor-${id})`}/>
        {[.25,.5,.75].map(value=><g key={value} className="cy-floor-grid"><path d={`M${210-190*value} ${18+126*value}L${400-190*value} ${144+126*value}`}/><path d={`M${210+190*value} ${18+126*value}L${20+190*value} ${144+126*value}`}/></g>)}
        <path d="M210 64L340 150L210 236L80 150Z" className="cy-network-wire"/>
        {motion&&active>=0&&<g className="cy-data-packets" key={`${recordedTime}-${active}`} aria-hidden="true">{[0,1,2].map(index=><circle key={index} r={index===0?2:1.2} fill={colors[active]} opacity={1-index*.2}><animateMotion dur="1.6s" begin={`${index*.2}s`} repeatCount="indefinite" path="M210 64L340 150L210 236L80 150Z"/></circle>)}</g>}
        {posts.map((post,index)=>{const check=checks.find(item=>item.stage===PIPELINE[index]),status=check?.status??'waiting',isActive=active===index;return <g key={index} className={`cy-node ${status} ${isActive?'active':''}`} tabIndex={0} role="button" aria-label={`${C.stage[PIPELINE[index]]}: ${C.status[status]}`} onClick={onInspect} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onInspect();}}} style={{'--node-color':colors[index]} as React.CSSProperties}>
          <title>{check?.reason?SPIDER.reasons[check.reason]:C.stageHint[PIPELINE[index]]}</title>
          <path d={`M${post.x-32} ${post.y+4}V${post.y+23}Q${post.x} ${post.y+48} ${post.x+32} ${post.y+23}V${post.y+4}`} className="cy-post-wall"/>
          <ellipse cx={post.x} cy={post.y+24} rx="32" ry="13" className="cy-post-base"/><ellipse cx={post.x} cy={post.y+4} rx="32" ry="13" className="cy-post-top"/>
          <ellipse cx={post.x} cy={post.y+4} rx="42" ry="19" className="cy-post-ring"/>
          {isActive && <ellipse cx={post.x} cy={post.y+4} rx="36" ry="16" className="cy-node-ping"/>}
          <text x={post.x} y={post.y+8} textAnchor="middle" className="cy-post-number">{status==='filled'?'✓':status==='blocked'?'!':`0${index+1}`}</text>
          <text x={post.x} y={index===0?post.y-27:post.y+57} textAnchor="middle" className="cy-node-label">{C.stage[PIPELINE[index]]}</text>
          <text x={post.x} y={index===0?post.y-14:post.y+69} textAnchor="middle" className="cy-node-value">{index===0?(replay?replay.evidence?.bid:snapshot?.bid)?.toLocaleString('en-US',{maximumFractionDigits:2})??'—':index===1?(cycle?.evidence?.proposedAction?.toUpperCase()??'—'):index===2?C.status[checks.find(item=>item.stage==='risk')?.status??'waiting']:action==='empty'?'—':action.toUpperCase()}</text>
        </g>;})}
        <g className="cy-spider-token" style={{transform:`translate(${location.x}px,${location.y-20}px)`,color:active>=0?colors[active]:'#c0a0ff'}}><ellipse cx="0" cy="24" rx="31" ry="10" fill="currentColor" opacity=".12"/><g className="cy-spider-lift" key={active}><svg x="-60" y="-65" width="120" height="110" viewBox="-60 -50 120 100"><g className="cy-spider-legs">{[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>{[0,1,2,3].map(index=><path key={index} className={`leg-${index}`} d={`M10 ${-17+index*10}L${26+index*2} ${-36+index*22}L${48-index*3} ${-40+index*26}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>)}</g>)}</g><ellipse cx="0" cy="12" rx="13" ry="19" fill="#121023" stroke="currentColor" strokeWidth="2"/><path d="M-4 8L0 15L4 8M0 15V23" stroke="currentColor" fill="none"/><ellipse cx="0" cy="-14" rx="10" ry="12" fill="currentColor"/><circle cx="-3.5" cy="-16" r="1.6" fill="#090812"/><circle cx="3.5" cy="-16" r="1.6" fill="#090812"/></svg></g></g>
        {active<0 && <text x="210" y="172" className="cy-core-label" textAnchor="middle">{mode==='paused'?'II':mode==='offline'?'!':C.rules}</text>}
      </svg>
      <div className="cy-space-hud"><span>SYS / {bot?String(bot.cycleCount??0).padStart(4,'0'):'0000'}</span><span>{active>=0?`${String(active+1).padStart(2,'0')} / ${C.stage[PIPELINE[active]]}`:C.mode[mode]}</span></div>
    </div>
    <div className="cy-pipeline" aria-label={C.recorded}>{PIPELINE.map((name,index)=>{const check=checks.find(item=>item.stage===name),status=check?.status??'waiting',Icon=index===0?ScanLine:index===1?Activity:index===2?Shield:Zap;return <button type="button" className={`${status} ${active===index?'active':''}`} title={check?.reason?SPIDER.reasons[check.reason]:C.stageHint[name]} key={name} onClick={onInspect}><Icon size={14}/><span>{C.stage[name]}<small>{C.status[status]}</small></span>{status==='passed'||status==='filled'?<Check size={10}/>:null}</button>;})}</div>
    <button className={`cy-result ${mode==='paused'?'paused':action}`} onClick={onInspect} title={lastReason?SPIDER.reasons[lastReason]:C.noRecord}><span className="cy-result-icon">{mode==='paused'?<CirclePause size={22}/>:action==='buy'?<ArrowUpRight size={23}/>:action==='sell'?<ArrowDownRight size={23}/>:<Activity size={23}/>}</span><span><strong>{mode==='paused'?C.mode.paused:mode==='offline'?C.mode.offline:C.action[action]}</strong><small>{lastReason?C.reasons[lastReason]:C.noCycles}</small></span><span className="cy-result-arrow">↗</span></button>
    <div className="cy-arena-footer"><span>{mode==='replay'?C.replay:C.recorded}<b>{cycle?new Date(cycle.time).toISOString().slice(11,19):'—'}</b></span>{bot?.config.strategy==='tape'&&mode!=='replay'?<span className="cy-warmup" title={C.warmup}><i><b style={{width:`${progress*100}%`}}/></i>{Math.min(30,bot.tapeReading?.windowSeconds??0).toFixed(0)}/30s</span>:<span>{C.checks}<b>{bot?.cycleCount??0}</b></span>}<span>{C.next}<b>{remaining===null?'—':remaining>0?`${remaining.toFixed(1)}s`:'…'}</b></span></div>
  </section>;
}
