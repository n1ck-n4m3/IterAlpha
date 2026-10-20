'use client';

import {useMemo,useRef,useState} from 'react';
import {ArrowDownLeft,ArrowRight,ArrowUpRight,ChevronLeft,ChevronRight,LockKeyhole,Minus,ShieldCheck,Sparkles} from 'lucide-react';
import {estimateOrder,RULES} from '../lib/training/engine';
import type {Action,DecisionInput,SessionView} from '../lib/training/types';
import {COPY} from '../lib/ui-copy';

type Order = Pick<DecisionInput,'action'|'amountUsd'|'sellPercent'|'stopPrice'|'reason'>;
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);

export default function DecisionFlow({session,busy,onCommit}:{session:SessionView;busy:boolean;onCommit:(order:Order)=>void}){
  const choices=useMemo(()=>{
    const result:Action[]=[];
    if(session.actions.includes('buy')&&session.account.cash>=10)result.push('buy');
    result.push(session.account.quantity>0?'hold':'wait');
    if(session.account.quantity>0)result.push('sell');
    return result;
  },[session.actions,session.account.cash,session.account.quantity]);
  const [index,setIndex]=useState(0);
  const [stage,setStage]=useState<'move'|'size'>('move');
  const [percent,setPercent]=useState(25);
  const [reason,setReason]=useState<string>('');
  const [stop,setStop]=useState(session.account.stopPrice??Number((session.candles.at(-1)!.close*0.97).toFixed(2)));
  const touchStart=useRef<number|null>(null);
  const action=choices[index]??choices[0];
  const price=session.candles.at(-1)!.close;
  const isBuy=action==='buy';
  const isSell=action==='sell';
  const amount=Math.min(session.account.cash,Math.max(10,session.account.cash*percent/100));
  const stopValid=stop>0&&stop<price*0.999&&(session.account.quantity>0?Math.abs(stop-session.account.stopPrice!)<0.01:stop>=price*0.8);
  const existingRisk=session.account.stopPrice===null?0:Math.max(0,session.account.quantity*(session.account.averageEntry*(1+RULES.feeRate)-session.account.stopPrice*(1-RULES.slippageRate)*(1-RULES.feeRate)));
  const estimate=estimateOrder(session.account.cash,price,stop,0,session.account.equity,existingRisk,amount);
  const saleQuantity=session.account.quantity*percent/100;
  const saleValue=saleQuantity*price*(1-RULES.slippageRate)*(1-RULES.feeRate);
  const valid=!isBuy||(session.account.cash>=10&&stopValid&&estimate.withinLimit);
  const defaultReason=isBuy?'Price structure':isSell?'Event uncertainty':'Need confirmation';
  const select=(next:number)=>setIndex((next+choices.length)%choices.length);
  const commit=()=>onCommit({action,...(isBuy?{amountUsd:amount,stopPrice:stop}:{}),...(isSell?{sellPercent:percent}:{}),reason:reason||defaultReason});

  return <section className="decision-panel decision-flow" aria-label="Decision flow">
    <div className="panel-title"><div><span className="eyebrow">DECISION {session.node+1} / {session.nodeCount}</span><h2>{stage==='move'?COPY.flow.heading:isBuy||isSell?COPY.flow.sizeHeading:COPY.flow.confirmHeading}</h2></div><span className="flow-stage">{stage==='move'?'01 / 02':'02 / 02'}</span></div>
    {stage==='move'?<>
      <p className="flow-instruction">{COPY.flow.instruction}</p>
      <div className="move-carousel" onTouchStart={event=>{touchStart.current=event.touches[0]?.clientX??null;}} onTouchEnd={event=>{if(touchStart.current===null)return;const distance=event.changedTouches[0].clientX-touchStart.current;if(Math.abs(distance)>35)select(index+(distance<0?1:-1));touchStart.current=null;}}>
        <button type="button" className="carousel-arrow" aria-label="Previous move" onClick={()=>select(index-1)} disabled={busy}><ChevronLeft size={20}/></button>
        <button key={`${session.id}-${session.version}-${action}`} type="button" className={`move-card ${action}`} data-glow onClick={()=>setStage('size')} disabled={busy} aria-label={`Choose ${action}`}>
          <span className="move-icon">{isBuy?<ArrowUpRight size={32}/>:isSell?<ArrowDownLeft size={32}/>:<Minus size={32}/>}</span>
          <strong>{action==='wait'?'Wait':action==='hold'?'Hold':isSell?'Sell':'Buy'}</strong>
          <span>{COPY.flow[action as 'buy'|'sell'|'hold'|'wait']}</span>
          <small>{COPY.flow.choose}<ArrowRight size={14}/></small>
        </button>
        <button type="button" className="carousel-arrow" aria-label="Next move" onClick={()=>select(index+1)} disabled={busy}><ChevronRight size={20}/></button>
      </div>
      <div className="carousel-dots" aria-label="Available moves">{choices.map((choice,position)=><button key={choice} type="button" className={position===index?'active':''} aria-label={`Show ${choice}`} aria-current={position===index?'true':undefined} onClick={()=>select(position)}/>)}</div>
      <p className="flow-hint"><Sparkles size={14}/>{session.track==='foundations'?COPY.drills.foundations[session.scene.topic][session.node%3]:COPY.drills.advanced[session.scene.topic][session.node%3]}</p>
    </>:<>
      <button type="button" className="flow-back" onClick={()=>setStage('move')} disabled={busy}><ChevronLeft size={15}/>{COPY.flow.back}</button>
      <div className={`flow-selected ${action}`}><span>{isBuy?<ArrowUpRight size={21}/>:isSell?<ArrowDownLeft size={21}/>:<Minus size={21}/>}</span><strong>{action==='wait'?'Wait':action==='hold'?'Hold':isSell?'Sell':'Buy'}</strong><small>{COPY.flow[action as 'buy'|'sell'|'hold'|'wait']}</small></div>
      {(isBuy||isSell)?<div className="flow-sizing">
        <div className="size-hero"><span>{isBuy?COPY.flow.cash:COPY.flow.position}</span><strong>{isBuy?money(session.account.cash):`${session.account.quantity.toFixed(6)} ${session.scene.asset}`}</strong></div>
      <div className="vertical-size" style={{'--size-fill':`${percent}%`} as React.CSSProperties}><div className="size-slider"><input type="range" aria-label={isBuy?'Percentage of available cash to buy':'Percentage of position to sell'} min="1" max="100" step="1" value={percent} onChange={event=>setPercent(Number(event.target.value))} disabled={busy}/><div className="slider-scale"><span>100%</span><span>50%</span><span>1%</span></div></div><div className="size-reading"><span>YOUR SIZE</span><strong>{percent}<small>%</small></strong><span>{isBuy?money(amount):`${saleQuantity.toFixed(6)} ${session.scene.asset}`}</span><button type="button" onClick={()=>setPercent(100)} className={percent===100?'selected':''} disabled={busy}>{COPY.flow.allIn}</button><small>{COPY.flow.allInHint}</small></div></div>
        {isBuy?<div className="flow-preview"><div><span>{COPY.flow.plannedSpend}</span><strong>{money(estimate.cost)}</strong></div><div><span>Estimated {session.scene.asset}</span><strong>{estimate.quantity.toFixed(6)}</strong></div><div><span>{COPY.flow.remainingCash}</span><strong>{money(Math.max(0,session.account.cash-estimate.cost))}</strong></div><div><span>{COPY.flow.risk}</span><strong>{money(estimate.risk)}</strong></div><div><span>{COPY.flow.stop}</span><strong>{money(stop)}</strong></div>{session.account.quantity===0&&<details><summary>Adjust protective stop</summary><input aria-label="Protective stop price" type="number" min={price*0.8} max={price*0.999} step="0.01" value={stop} onChange={event=>setStop(Number(event.target.value))}/><small>{COPY.flow.stopHint}</small></details>}{estimate.risk+existingRisk>session.account.equity*0.02&&<p className="risk-warning">{COPY.flow.riskWarning}</p>}{!stopValid&&<p className="field-error">Choose a stop below the current price and no more than 20% below it.</p>}</div>:<div className="flow-preview"><div><span>{COPY.flow.plannedSale}</span><strong>{money(saleValue)}</strong></div><div><span>{COPY.flow.remainingPosition}</span><strong>{(session.account.quantity-saleQuantity).toFixed(6)} {session.scene.asset}</strong></div><div><span>{COPY.flow.remainingCash}</span><strong>{money(session.account.cash+saleValue)}</strong></div></div>}
      </div>:<p className="flow-pause-note">{action==='hold'?COPY.flow.hold:COPY.flow.wait} {session.account.stopPrice!==null&&`Your stop remains at ${money(session.account.stopPrice)}.`}</p>}
      <div className="reason-choices"><span>{COPY.flow.why}</span><div>{COPY.reasons.map(option=><button key={option} type="button" disabled={busy} aria-pressed={(reason||defaultReason)===option} className={(reason||defaultReason)===option?'selected':''} onClick={()=>setReason(option)}>{option}</button>)}</div></div>
      <button className="primary flow-commit" disabled={busy||!valid} onClick={commit}>{busy?'Saving decision…':COPY.flow.confirm}<ArrowRight size={17}/></button>
      <p className="flow-disclosure"><LockKeyhole size={12}/>{COPY.flow.reveal} {COPY.flow.execution}</p>
    </>}
    <div className="flow-safety"><ShieldCheck size={14}/>Virtual spot trading · no real funds</div>
  </section>;
}
