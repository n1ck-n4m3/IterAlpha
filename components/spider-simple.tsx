'use client';
import LocalizedContent from './localized-content';



import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ChevronDown, CirclePause, Play, ShieldCheck, Wallet, Waves, X, Activity, SlidersHorizontal, ArrowDownLeft} from 'lucide-react';
import type {BotStats, BotView, Market, Snapshot} from '../lib/spider/types';
import {MANDATES, SIMPLE as C, type MandateId} from '../lib/spider/mandates';
import AnimatedNumber from './animated-number';
import SpiderChart from './spider-chart';
import CyberSpider from './cyber-spider';
import {normalizedSeries} from '../lib/spider/cockpit';

const num = (n: number, digits = 2) => new Intl.NumberFormat('en-US', {maximumFractionDigits: digits}).format(n);
type Props = {
  bot: BotView | null; metrics: BotStats | null; snapshot: Snapshot | null; market?: Market; markets: Market[];
  fresh: boolean; feedUnavailable: boolean; observing: boolean; busy: boolean; loading: boolean; disabled: boolean; motion: boolean;
  capital: string; mandate: MandateId | null; settingsError: string;
  onCapital: (value: string) => void; onMandate: (id: MandateId) => void; onMarket: (market: Market) => void;
  onMarkets: () => void; onStart: () => void; onCommand: (action: 'pause'|'resume'|'close') => void;
  onPanel: (panel: 'setup'|'ledger'|'evidence') => void;
};
function AccountHistory({bot}: {bot: BotView | null}) {
  const rows = bot?.cycles ?? [];
  if (!bot || !rows.length) return <LocalizedContent>{<div className="sa-history-empty"><Wallet size={32}/><p>{C.historyEmpty}</p></div>}</LocalizedContent>;
  const points = [{time: bot.createdAt, equity: bot.config.initialCash}, ...rows];
  const min = Math.min(...points.map(p=>p.equity)), max = Math.max(...points.map(p=>p.equity));
  const padding = Math.max((max-min)*.15, bot.config.initialCash*.0003), low = min-padding, high = max+padding;
  const start = points[0].time, end = Math.max(start+1, points.at(-1)!.time);
  const xy = (p: typeof points[number]) => ({x:40+(p.time-start)/(end-start)*840, y:20+(high-p.equity)/(high-low)*225});
  const baseline=xy({time:start,equity:bot.config.initialCash}).y;
  return <LocalizedContent>{<div className="sa-account-history"><svg viewBox="0 0 920 285" role="img" aria-label={C.wallet}>
    {[0,1,2,3].map(i=><g key={i}><line x1="40" x2="880" y1={20+i*75} y2={20+i*75} stroke="#ffffff0c"/><text x="44" y={15+i*75} fill="#86809b" fontSize="10">{num(high-i/3*(high-low))}</text></g>)}
    <line x1="40" x2="880" y1={baseline} y2={baseline} stroke="#b89aff44" strokeDasharray="4 6"/>
    {points.slice(1).map((p,i)=>{const a=xy(points[i]),b=xy(p);return <line key={`${p.time}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a993ff" strokeWidth="2.5" strokeDasharray={p.time-points[i].time>60000?'5 6':undefined}/>;})}
    <circle cx={xy(points.at(-1)!).x} cy={xy(points.at(-1)!).y} r="4" fill="#c8b5ff"/>
    <text x="40" y="277" fill="#86809b" fontSize="10">{new Date(start).toLocaleTimeString('en-GB')} </text><text x="880" y="277" textAnchor="end" fill="#86809b" fontSize="10">{new Date(end).toLocaleTimeString('en-GB')}</text>
  </svg><small>{C.historyNote}</small></div>}</LocalizedContent>;
}
export default function SpiderSimple(p: Props) {
  const {bot,snapshot,metrics,fresh,motion}=p;
  const [popup,setPopup]=useState<'strategy'|'budget'|'chart'|'wallet'|null>(null),[stage,setStage]=useState(0);
  const popupRef=useRef<HTMLDialogElement>(null),worldRef=useRef<HTMLDivElement>(null);
  const lastPopup=useRef(popup);if(popup)lastPopup.current=popup;const visiblePopup=popup??lastPopup.current;
  const lastCycle=bot?.cycles?.at(-1),key=lastCycle?`${bot?.id}:${lastCycle.time}`:'';
  useEffect(()=>{if(popup&&!popupRef.current?.open)popupRef.current?.showModal();else if(!popup)popupRef.current?.close();},[popup]);
  useEffect(()=>{if(!key)return;if(!motion||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setStage(3);return;}setStage(1);const a=setTimeout(()=>setStage(2),400),b=setTimeout(()=>setStage(3),1050);return()=>{clearTimeout(a);clearTimeout(b);};},[key,motion]);
  const quote=p.market?.quote??'USDT',base=p.market?.base??'BTC',positive=(metrics?.netPnl??0)>=0;
  const planId=bot?.config.mandate??p.mandate,plan=planId?MANDATES[planId]:null;
  const inPosition=!!bot?.quantity,running=bot?.status==='running';
  const connecting=!snapshot&&!p.feedUnavailable;
  const title=connecting?C.connecting:!fresh?C.offline:!bot?C.ready:!running?C.paused:lastCycle?C.fill[lastCycle.action]:C.observe;
  const detail=connecting?C.connectingDetail:!fresh?C.offlineDetail:!bot?C.readyDetail:!running?inPosition?C.pausedOpen:C.pausedFlat:lastCycle?C.reason[lastCycle.reason]:C.noRecord;
  const label=p.busy?C.pending:!bot?C.start:running?inPosition?C.close:C.pause:C.resume;
  const onAction=()=>!bot?p.onStart():p.onCommand(running?inPosition?'close':'pause':'resume');
  const disabled=p.disabled||(running&&inPosition&&!fresh),lastFill=bot?.trades.at(-1);
  const budgetScale=['BTC','ETH','BNB'].includes(quote)?{min:.001,max:10,step:.001}:{min:100,max:100000,step:100};
  const candles=snapshot?.candles.slice(-100)??[],path=normalizedSeries(candles.map(c=>c.close),1000,220);
  function parallax(event:React.PointerEvent<HTMLDivElement>){if(!motion||event.pointerType==='touch')return;const b=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--look-x',`${(event.clientX-b.left-b.width/2)/b.width*12}px`);event.currentTarget.style.setProperty('--look-y',`${(event.clientY-b.top-b.height/2)/b.height*8}px`);}
  return <LocalizedContent>{<section className={`orbit-workspace ${running&&fresh?'agent-running':''}`}>
    <header className="ow-intro"><div><span>{C.eyebrow}</span><h2>{C.title}</h2></div><span className={`ow-live ${fresh?'online':''}`}><i/>{connecting?C.connecting:fresh?C.live:C.stale}<small>{C.virtual}</small></span></header>
    <div ref={worldRef} className={`ow-world phase-${running&&fresh?stage:0}`} onPointerMove={parallax} onPointerLeave={()=>{worldRef.current?.style.setProperty('--look-x','0px');worldRef.current?.style.setProperty('--look-y','0px');}}>
      <div className="ow-nebula" aria-hidden="true"/><div className="ow-horizon" aria-hidden="true"/>
      <svg fill="none" className="ow-orbits" viewBox="0 0 1200 550" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ow-orbit-light"><stop stopColor="#c193ff" stopOpacity="0"/><stop offset=".4" stopColor="#c193ff" stopOpacity=".4"/><stop offset="1" stopColor="#a09aff" stopOpacity="0"/></linearGradient></defs><ellipse cx="600" cy="300" rx="420" ry="155" stroke="url(#ow-orbit-light)"/><ellipse cx="600" cy="300" rx="330" ry="205" stroke="#b89aff0c" transform="rotate(-16 600 300)"/><path className="ow-wire" d="M170 170Q365 60 585 268T1015 205" stroke="#bb93ff36" strokeDasharray="2 8"/><path className="ow-wire" d="M255 370Q360 470 600 315T960 90" stroke="#9c8bff24" strokeDasharray="2 8"/></svg>
      <button className={`ow-market-node ${p.observing?'receiving':''}`} onClick={p.onMarkets} disabled={p.busy||p.loading}><span className="ow-coin">{base==='BTC'?'₿':base==='ETH'?'Ξ':base.slice(0,1)}</span><span><small>{p.market?.venue??'Binance'} / {C.marketUpdated}</small><b data-i18n="source">{base} <em>/ {quote}</em><ChevronDown size={12}/></b><strong>{snapshot?<AnimatedNumber value={snapshot.price} animate={motion} format={v=>num(v,snapshot.price<1?8:2)}/>:'—'}</strong></span><i className={(snapshot?.change24h??0)>=0?'positive':'negative'}>{snapshot?.change24h==null?'—':`${snapshot.change24h>=0?'+':''}${snapshot.change24h.toFixed(2)}%`}<small>24H</small></i></button>
      <button className="ow-fortune" onClick={()=>setPopup('wallet')} aria-label={C.walletOpen}><div className="ow-fortune-rim"/><span>{bot?C.account:C.preview}<small data-i18n="source">{quote}</small></span><strong><AnimatedNumber key={bot?.id??'draft'} value={metrics?.equity??(Number(p.capital)||0)} animate={motion} format={v=>num(v)}/></strong><b className={metrics?positive?'positive':'negative':''}>{metrics?`${metrics.netPnl>=0?'+':''}${num(metrics.netPnl)}`:'—'} <small>{metrics?`${metrics.returnPercent>=0?'+':''}${metrics.returnPercent.toFixed(2)}%`:C.profit}</small></b><em>{C.afterCosts}</em><ArrowUpRight size={15}/></button>
      <button className="ow-guard-node" onClick={()=>p.onPanel('setup')}><ShieldCheck size={15}/><span>{C.guardNode}<small>{C.guardLabel}</small></span><i/></button>
      <div className="ow-agent"><div className="ow-agent-aura"/><CyberSpider active={running&&fresh} stage={stage}/><span className="ow-agent-name">SPIDER <small>/ 01</small><i className={running&&fresh?'awake':''}/></span></div>
      <button className="ow-thought" disabled={!lastCycle} onClick={()=>p.onPanel('evidence')}><span className="ow-thought-label"><i/>{lastCycle?`${C.liveCheck} · ${new Date(lastCycle.time).toLocaleTimeString('en-GB',{timeZone:'UTC'})+' UTC'}`:C.rule}</span><strong>{title}</strong><span className="ow-thought-detail">{detail}</span>{lastCycle&&<span className="ow-thought-link">{C.evidence}<ArrowUpRight size={11}/></span>}</button>
      <div className="ow-balances"><span><i/>{C.cash}<b>{num(bot?.cash??(Number(p.capital)||0))}</b></span><span><i/>{C.invested}<b>{metrics?num(Math.max(0,metrics.equity-(bot?.cash??0))):'—'}</b></span></div>
      <div className="ow-market-ribbon" aria-hidden="true"><svg viewBox="0 0 1000 240" preserveAspectRatio="none"><defs><linearGradient id="ow-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a880ff" stopOpacity=".13"/><stop offset="1" stopColor="#a880ff" stopOpacity="0"/></linearGradient><linearGradient id="ow-chart-stroke"><stop stopColor="#a680ff" stopOpacity="0"/><stop offset=".2" stopColor="#a680ff" stopOpacity=".55"/><stop offset=".7" stopColor="#d9b3ff" stopOpacity=".8"/><stop offset="1" stopColor="#a680ff" stopOpacity=".1"/></linearGradient></defs>{path&&<><path d={`${path} L1000,240 L0,240 Z`} fill="url(#ow-chart-fill)"/><path d={path} fill="none" stroke="url(#ow-chart-stroke)" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></>}</svg></div>
      <button className="ow-chart-peek" disabled={!snapshot} onClick={()=>setPopup('chart')}><Activity size={12}/>{C.chartOpen}<ArrowUpRight size={12}/></button>
      <button className="ow-fill-comet" onClick={()=>p.onPanel('ledger')} key={lastFill?.id??'empty'}><span className={`ow-fill-icon ${lastFill?.side??'hold'}`}>{lastFill?.side==='buy'?<ArrowDownLeft size={17}/>:lastFill?.side==='sell'?<ArrowUpRight size={17}/>:<Waves size={17}/>}</span><span><small>{C.activity}</small><b>{lastFill?`${C.fill[lastFill.side]} ${num(lastFill.quantity,6)} ${base}`:C.noFills}</b></span><ArrowUpRight size={12}/></button>
    </div>
    <div className="ow-command-zone"><div className="ow-command-glow" aria-hidden="true"/><div className="ow-command-dock"><button className="ow-dock-strategy" onClick={()=>bot?p.onPanel('setup'):setPopup('strategy')} disabled={p.busy||p.loading}><span className="ow-strategy-glyph"><SlidersHorizontal size={18}/></span><span><small>{C.strategy}</small><b>{plan?.name??C.custom}</b></span><ChevronDown size={13}/></button><div className="ow-dock-divider"/><button className="ow-dock-budget" onClick={()=>bot?p.onPanel('setup'):setPopup('budget')} disabled={p.busy||p.loading}><span><small>{C.budget}</small><b>{num(bot?.config.initialCash??(Number(p.capital)||0))}<em>{quote}</em></b></span>{!bot&&<ChevronDown size={13}/>}</button><button className="ow-launch" disabled={disabled} onClick={onAction}>{p.busy?<span className="cy-button-spinner"/>:running?<CirclePause size={18}/>:<Play size={18}/>}<span>{label}</span><ArrowUpRight size={15}/></button></div><p className="ow-command-hint" role="status">{p.settingsError||(!bot?C.setupHint:!running&&inPosition?C.pausedOpen:plan?.subtitle??C.rule)}</p>{inPosition&&!running&&<button className="ow-close-position" disabled={p.busy||!fresh} onClick={()=>p.onCommand('close')}>{C.close}<ArrowUpRight size={12}/></button>}</div>
    <footer className="ow-foot"><div><span><b>{bot?.cycleCount??bot?.cycles?.length??0}</b>{C.checks}</span><span><b>{metrics?.closedTrades??0}</b>{C.trades}</span><span><b>{metrics?.winRate==null?'—':`${metrics.winRate.toFixed(0)}%`}</b>{C.winRate}</span><span><b>{bot?num(bot.fees,4):'—'}</b>{C.paid}</span></div><button onClick={()=>p.onPanel('ledger')}>{C.activityOpen}<ArrowUpRight size={12}/></button><small>{C.model} · {C.browser}</small></footer>
    <dialog ref={popupRef} className={`ow-popup ow-popup-${visiblePopup??'closed'}`} onCancel={()=>setPopup(null)} onClick={e=>{if(e.target===e.currentTarget)setPopup(null);}} aria-labelledby="ow-popup-title"><button className="ow-popup-close" onClick={()=>setPopup(null)} aria-label={C.closePopup}><X size={18}/></button><span className="ow-popup-eyebrow">SPIDER / {C.virtual}</span><h3 id="ow-popup-title">{visiblePopup==='strategy'?C.chooseStrategy:visiblePopup==='budget'?C.chooseBudget:visiblePopup==='wallet'?C.wallet:C.market}</h3>
      {visiblePopup==='strategy'&&<><div className="ow-strategy-fan">{(Object.keys(MANDATES) as MandateId[]).map((id,i)=><button key={id} style={{'--fan-index':i} as React.CSSProperties} className={p.mandate===id?'selected':''} aria-pressed={p.mandate===id} onClick={()=>{p.onMandate(id);setPopup(null);}}><span className="ow-fan-emblem">{i===0?<ShieldCheck size={33}/>:i===1?<Waves size={33}/>:<Activity size={33}/>}</span><small>0{i+1}</small><b>{MANDATES[id].name}</b><p>{MANDATES[id].detail}</p><span className="ow-fan-meta">{C.stop} {MANDATES[id].stopPercent}% / {C.target} {MANDATES[id].targetPercent}%</span><ArrowUpRight size={17}/></button>)}</div><p className="ow-popup-note">{C.limits}. {C.guardNote}</p></>}
      {visiblePopup==='budget'&&<div className="ow-budget-editor"><label htmlFor="ow-capital">{C.budget}</label><div><input id="ow-capital" type="number" min="0.0001" max="1000000000" step="any" value={p.capital} onChange={e=>p.onCapital(e.target.value)}/><span>{quote}</span></div><input aria-label={C.budget} type="range" min={budgetScale.min} max={budgetScale.max} step={budgetScale.step} value={Math.max(budgetScale.min,Math.min(budgetScale.max,Number(p.capital)||budgetScale.min))} onChange={e=>p.onCapital(e.target.value)}/><p>{C.paper}</p>{p.settingsError&&<p role="status">{p.settingsError}</p>}<button className="ow-launch" onClick={()=>setPopup(null)}>{C.apply}<ArrowUpRight size={15}/></button></div>}
      {visiblePopup==='chart'&&snapshot&&<div className="ow-expanded-chart"><SpiderChart compact motion={motion} snapshot={snapshot} trades={bot?.trades??[]} stop={bot?.stop??null} target={bot?.target??null} entry={inPosition?bot!.entryPrice:null}/></div>}
      {visiblePopup==='wallet'&&<><div className="ow-wallet-total">{num(metrics?.equity??(Number(p.capital)||0))}<small data-i18n="source">{quote}</small></div><AccountHistory bot={bot}/><p className="ow-popup-note">{C.afterCosts}. {C.historyNote}.</p></>}
    </dialog>
  </section>}</LocalizedContent>;
}
