'use client';
import {useMemo,useState} from 'react';
import type {Candle,Fill} from '../lib/training/types';

export type ChartStyle='candles'|'hollow'|'bars'|'highlow'|'line'|'markers'|'step'|'area'|'baseline'|'heikin';
export const chartStyles:{value:ChartStyle;label:string}[]=[
  {value:'candles',label:'Candles'},{value:'hollow',label:'Hollow candles'},{value:'bars',label:'OHLC bars'},{value:'highlow',label:'HLC bars'},
  {value:'line',label:'Line'},{value:'markers',label:'Line with markers'},{value:'step',label:'Step line'},
  {value:'area',label:'Area'},{value:'baseline',label:'Baseline'},{value:'heikin',label:'Heikin Ashi'}
];
export function heikinAshi(candles:Candle[]):Candle[]{let priorOpen=0,priorClose=0;return candles.map((c,index)=>{const close=(c.open+c.high+c.low+c.close)/4;const open=index===0?(c.open+c.close)/2:(priorOpen+priorClose)/2;priorOpen=open;priorClose=close;return {...c,open,close,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close)};});}
const W=1000,H=420,L=27,R=102,T=28,B=54;
const priceLabel=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value);
const stamp=(value:number)=>new Date(value*1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',hour12:false,timeZone:'UTC'});

export default function MarketChart({candles,fills,stop,revision,style='candles',training=true,referencePrice}:{candles:Candle[];fills:Fill[];stop:number|null;revision:string;style?:ChartStyle;training?:boolean;referencePrice?:number}){
  const [hover,setHover]=useState<number|null>(null);
  const display=useMemo(()=>style==='heikin'?heikinAshi(candles):candles,[candles,style]);
  const info=useMemo(()=>{if(!display.length)return null;const low=Math.min(...display.map(c=>c.low),...(stop&&style!=='heikin'?[stop]:[]));const high=Math.max(...display.map(c=>c.high),...(referencePrice?[referencePrice]:[]));const pad=Math.max((high-low)*.11,high*.001);const min=low-pad,max=high+pad;const x=(index:number)=>L+(index+.5)*(W-L-R)/display.length;const y=(value:number)=>T+(max-value)/(max-min)*(H-T-B);const line=display.map((c,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(' ');const step=display.map((c,i)=>i?`H${x(i).toFixed(2)} V${y(c.close).toFixed(2)}`:`M${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(' ');const area=`${line} L${x(display.length-1).toFixed(2)},${H-B} L${x(0).toFixed(2)},${H-B} Z`;const maxVolume=Math.max(1,...display.map(c=>c.volume??0));return {min,max,x,y,line,step,area,maxVolume};},[display,stop,style,referencePrice]);
  if(!info)return <div className="market-chart market-chart-empty">Chart data is unavailable.</div>;
  const {min,max,x,y,line,step,area,maxVolume}=info;
  const candleWidth=Math.max(2,Math.min(11,(W-L-R)/display.length*.65));
  const current=hover===null?null:display[hover];
  const baseline=display[0].close;
  return <div className="market-chart market-chart-svg" onMouseMove={event=>{const box=event.currentTarget.getBoundingClientRect();const relative=(event.clientX-box.left)/box.width*W;const index=Math.floor((relative-L)/(W-L-R)*display.length);setHover(index>=0&&index<display.length?index:null);}} onMouseLeave={()=>setHover(null)}>
    <svg data-revision={revision} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${style} chart with ${candles.length} visible bars. Last visible close ${candles.at(-1)?.close.toFixed(2)} dollars.${training?' Future prices are hidden until a decision is saved.':''}`}>
      <defs><linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c073ee" stopOpacity=".42"/><stop offset="1" stopColor="#c073ee" stopOpacity=".015"/></linearGradient><radialGradient id="chartSurface"><stop stopColor="#281339"/><stop offset="1" stopColor="#0d0817"/></radialGradient></defs>
      <rect width={W} height={H} fill="url(#chartSurface)"/>
      {Array.from({length:5},(_,i)=>{const yy=T+i*(H-T-B)/4;return <g key={i}><line x1={L} x2={W-R+9} y1={yy} y2={yy} stroke="#ae73cb48" strokeWidth="1" strokeDasharray="3 6"/><text x={W-R+16} y={yy+4} fill="#c8b0d8" fontSize="12">{priceLabel(max-(max-min)*i/4)}</text></g>;})}
      {Array.from({length:6},(_,i)=>{const index=Math.min(display.length-1,Math.round(i*(display.length-1)/5));const xx=x(index);return <g key={i}><line x1={xx} x2={xx} y1={T} y2={H-B} stroke="#9563b338" strokeWidth="1"/><text x={xx} y={H-20} textAnchor="middle" fill="#c8b0d8" fontSize="11">{stamp(display[index].time)}</text></g>;})}
      {display.map((c,i)=>c.volume===undefined?null:<rect key={`v-${i}`} x={x(i)-candleWidth/2} y={H-B-(c.volume/maxVolume)*43} width={Math.max(1,candleWidth)} height={(c.volume/maxVolume)*43} fill={c.close>=c.open?'#72e2c72b':'#ff9cb72b'}/>)}
      {(style==='candles'||style==='hollow'||style==='heikin')&&display.map((c,i)=>{const up=c.close>=c.open,color=up?'#81e3cb':'#ff99bd',top=y(Math.max(c.open,c.close)),bottom=y(Math.min(c.open,c.close));return <g key={i}><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.6"/><rect x={x(i)-candleWidth/2} y={top} width={candleWidth} height={Math.max(2,bottom-top)} fill={up&&style==='hollow'?'#1b1028':color} stroke={color} strokeWidth="1.2" rx="1"/></g>;})}
      {(style==='bars'||style==='highlow')&&display.map((c,i)=>{const color=c.close>=c.open?'#72e2c7':'#ff9cb7';return <g key={i} stroke={color} strokeWidth="2"><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)}/>{style==='bars'&&<line x1={x(i)-candleWidth/2} x2={x(i)} y1={y(c.open)} y2={y(c.open)}/>}<line x1={x(i)} x2={x(i)+candleWidth/2} y1={y(c.close)} y2={y(c.close)}/></g>;})}
      {style==='area'&&<path d={area} fill="url(#chartArea)"/>}
      {(['line','markers','step','area'] as ChartStyle[]).includes(style)&&<path d={style==='step'?step:line} fill="none" stroke="#ce96fb" strokeWidth="2.8" strokeLinejoin="round"/>}
      {style==='baseline'&&display.slice(1).map((c,i)=><line key={i} x1={x(i)} y1={y(display[i].close)} x2={x(i+1)} y2={y(c.close)} stroke={c.close>=baseline?'#72e2c7':'#ff9cb7'} strokeWidth="2.8"/>)}
      {style==='markers'&&display.map((c,i)=><circle key={i} cx={x(i)} cy={y(c.close)} r="2.5" fill="#e7baff"/>)}
      {style==='baseline'&&<line x1={L} x2={W-R} y1={y(baseline)} y2={y(baseline)} stroke="#bd8bdb" strokeDasharray="4 5"/>}
      {stop!==null&&style!=='heikin'&&<g><line x1={L} x2={W-R} y1={y(stop)} y2={y(stop)} stroke="#d8a675" strokeDasharray="7 6"/><text x={W-R+16} y={y(stop)-7} fill="#e4ae7b" fontSize="11">STOP</text></g>}
      {referencePrice!==undefined&&style!=='heikin'&&<line x1={L} x2={W-R} y1={y(referencePrice)} y2={y(referencePrice)} stroke="#d7acff" strokeDasharray="3 5"/>}
      {fills.filter(fill=>fill.time>=display[0].time&&fill.time<=display.at(-1)!.time+(display[1]?.time-display[0].time||900)).map(fill=>{const index=Math.max(0,Math.min(display.length-1,Math.floor((fill.time-display[0].time)/(display[1]?.time-display[0].time||900))));const yy=fill.side==='buy'?y(display[index].low)+16:y(display[index].high)-15;return <g key={fill.id}><circle cx={x(index)} cy={yy} r="9" fill={fill.side==='buy'?'#8d7cff':'#e780b5'}/><text x={x(index)} y={yy+3} textAnchor="middle" fill="#fff" fontSize="9">{fill.side==='buy'?'B':'S'}</text></g>;})}
      {current&&<g><line x1={x(hover!)} x2={x(hover!)} y1={T} y2={H-B} stroke="#d9b6ee" strokeDasharray="3 4"/><circle cx={x(hover!)} cy={y(current.close)} r="5" fill="#f1d9ff"/></g>}
      <line x1={L} x2={W-R+8} y1={H-B} y2={H-B} stroke="#a874c07d"/>
    </svg>
    {current&&<div className="chart-hover" aria-live="off"><strong>{stamp(current.time)} UTC</strong><span>O {priceLabel(current.open)} · H {priceLabel(current.high)} · L {priceLabel(current.low)} · C {priceLabel(current.close)}</span></div>}
  </div>;
}
