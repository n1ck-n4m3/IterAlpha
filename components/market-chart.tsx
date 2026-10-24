'use client';
import {useMemo,useState} from 'react';
import type {Candle,Fill} from '../lib/training/types';
import {macd,rsi,sma} from '../lib/training/indicators';

export type ChartStyle='candles'|'hollow'|'bars'|'highlow'|'line'|'markers'|'step'|'area'|'baseline'|'heikin';
export type ChartIndicators={ma7:boolean;ma25:boolean;volume:boolean;macd:boolean;rsi:boolean};
export const DEFAULT_INDICATORS:ChartIndicators={ma7:true,ma25:true,volume:true,macd:false,rsi:false};
export const chartStyles:{value:ChartStyle;label:string}[]=[
  {value:'candles',label:'Candles'},{value:'hollow',label:'Hollow candles'},{value:'bars',label:'OHLC bars'},{value:'highlow',label:'HLC bars'},
  {value:'line',label:'Line'},{value:'markers',label:'Line with markers'},{value:'step',label:'Step line'},
  {value:'area',label:'Area'},{value:'baseline',label:'Baseline'},{value:'heikin',label:'Heikin Ashi'}
];
export function heikinAshi(candles:Candle[]):Candle[]{let priorOpen=0,priorClose=0;return candles.map((c,index)=>{const close=(c.open+c.high+c.low+c.close)/4;const open=index===0?(c.open+c.close)/2:(priorOpen+priorClose)/2;priorOpen=open;priorClose=close;return {...c,open,close,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close)};});}
const W=1000,H=420,L=27,R=102,T=28,B=54;
const priceLabel=(value:number,locale:string)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2,minimumFractionDigits:2}).format(value);
const stamp=(value:number,locale:string)=>new Date(value*1000).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',hour12:false,timeZone:'UTC'});

export default function MarketChart({candles,fills,stop,revision,style='candles',training=true,referencePrice,indicators=DEFAULT_INDICATORS,locale='en-US'}:{candles:Candle[];fills:Fill[];stop:number|null;revision:string;style?:ChartStyle;training?:boolean;referencePrice?:number;indicators?:ChartIndicators;locale?:string}){
  const [hover,setHover]=useState<number|null>(null);
  const display=useMemo(()=>style==='heikin'?heikinAshi(candles):candles,[candles,style]);
  const closes=useMemo(()=>candles.map(c=>c.close),[candles]);
  const ma7=useMemo(()=>sma(closes,7),[closes]);
  const ma25=useMemo(()=>sma(closes,25),[closes]);
  const macdSeries=useMemo(()=>macd(closes),[closes]);
  const rsiSeries=useMemo(()=>rsi(closes),[closes]);
  const info=useMemo(()=>{if(!display.length)return null;const low=Math.min(...display.map(c=>c.low),...(stop&&style!=='heikin'?[stop]:[]));const high=Math.max(...display.map(c=>c.high),...(referencePrice?[referencePrice]:[]));const pad=Math.max((high-low)*.11,high*.001);const min=low-pad,max=high+pad;const x=(index:number)=>L+(index+.5)*(W-L-R)/display.length;const y=(value:number)=>T+(max-value)/(max-min)*(H-T-B);const line=display.map((c,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(' ');const step=display.map((c,i)=>i?`H${x(i).toFixed(2)} V${y(c.close).toFixed(2)}`:`M${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(' ');const area=`${line} L${x(display.length-1).toFixed(2)},${H-B} L${x(0).toFixed(2)},${H-B} Z`;const maxVolume=Math.max(1,...display.map(c=>c.volume??0));return {min,max,x,y,line,step,area,maxVolume};},[display,stop,style,referencePrice]);
  if(!info)return <div className="market-chart market-chart-empty">Chart data is unavailable.</div>;
  const {min,max,x,y,line,step,area,maxVolume}=info;
  const candleWidth=Math.max(2,Math.min(11,(W-L-R)/display.length*.65));
  const current=hover===null?null:display[hover];
  const baseline=display[0].close;
  const hasVolume=indicators.volume&&display.some(c=>c.volume!==undefined);
  const volumeTop=H-B+17,volumeBottom=volumeTop+(hasVolume?70:0);
  const macdTop=volumeBottom+(indicators.macd?18:0),macdBottom=macdTop+(indicators.macd?95:0);
  const rsiTop=macdBottom+(indicators.rsi?18:0),rsiBottom=rsiTop+(indicators.rsi?95:0);
  const plotBottom=indicators.rsi?rsiBottom:indicators.macd?macdBottom:hasVolume?volumeBottom:H-B;
  const totalH=plotBottom+54;
  const valuePath=(values:(number|null)[],scale:(value:number)=>number)=>{let active=false;return values.map((value,index)=>{if(value===null){active=false;return '';}const segment=`${active?'L':'M'}${x(index).toFixed(2)},${scale(value).toFixed(2)}`;active=true;return segment;}).filter(Boolean).join(' ');};
  const macdValues=[...macdSeries.line,...macdSeries.signal,...macdSeries.histogram].filter((value):value is number=>value!==null);
  const macdExtent=Math.max(.0001,...macdValues.map(Math.abs)),macdZero=(macdTop+macdBottom)/2;
  const macdY=(value:number)=>macdZero-value/macdExtent*(macdBottom-macdTop)*.42;
  const rsiY=(value:number)=>rsiBottom-value/100*(rsiBottom-rsiTop);
  return <div className="market-chart market-chart-svg" style={{height:Math.round(totalH*.78)}} onMouseMove={event=>{const box=event.currentTarget.getBoundingClientRect();const relative=(event.clientX-box.left)/box.width*W;const index=Math.floor((relative-L)/(W-L-R)*display.length);setHover(index>=0&&index<display.length?index:null);}} onMouseLeave={()=>setHover(null)}>
    <svg data-revision={revision} viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="none" role="img" aria-label={`${style} chart with ${candles.length} visible bars. Last visible close ${candles.at(-1)?.close.toFixed(2)} dollars.${training?' Future prices are hidden until a decision is saved.':''}`}>
      <defs><linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c073ee" stopOpacity=".42"/><stop offset="1" stopColor="#c073ee" stopOpacity=".015"/></linearGradient><radialGradient id="chartSurface"><stop stopColor="#281339"/><stop offset="1" stopColor="#0d0817"/></radialGradient></defs>
      <rect width={W} height={H} fill="url(#chartSurface)"/>
      {Array.from({length:5},(_,i)=>{const yy=T+i*(H-T-B)/4;return <g key={i}><line x1={L} x2={W-R+9} y1={yy} y2={yy} stroke="#ae73cb48" strokeWidth="1" strokeDasharray="3 6"/><text x={W-R+16} y={yy+4} fill="#c8b0d8" fontSize="12">{priceLabel(max-(max-min)*i/4,locale)}</text></g>;})}
      {Array.from({length:6},(_,i)=>{const index=Math.min(display.length-1,Math.round(i*(display.length-1)/5));const xx=x(index);return <g key={i}><line x1={xx} x2={xx} y1={T} y2={plotBottom} stroke="#9563b338" strokeWidth="1"/><text x={xx} y={totalH-20} textAnchor="middle" fill="#c8b0d8" fontSize="11">{stamp(display[index].time,locale)}</text></g>;})}
      {(style==='candles'||style==='hollow'||style==='heikin')&&display.map((c,i)=>{const up=c.close>=c.open,color=up?'#81e3cb':'#ff99bd',top=y(Math.max(c.open,c.close)),bottom=y(Math.min(c.open,c.close));return <g key={i}><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.6"/><rect x={x(i)-candleWidth/2} y={top} width={candleWidth} height={Math.max(2,bottom-top)} fill={up&&style==='hollow'?'#1b1028':color} stroke={color} strokeWidth="1.2" rx="1"/></g>;})}
      {(style==='bars'||style==='highlow')&&display.map((c,i)=>{const color=c.close>=c.open?'#72e2c7':'#ff9cb7';return <g key={i} stroke={color} strokeWidth="2"><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)}/>{style==='bars'&&<line x1={x(i)-candleWidth/2} x2={x(i)} y1={y(c.open)} y2={y(c.open)}/>}<line x1={x(i)} x2={x(i)+candleWidth/2} y1={y(c.close)} y2={y(c.close)}/></g>;})}
      {style==='area'&&<path d={area} fill="url(#chartArea)"/>}
      {(['line','markers','step','area'] as ChartStyle[]).includes(style)&&<path d={style==='step'?step:line} fill="none" stroke="#ce96fb" strokeWidth="2.8" strokeLinejoin="round"/>}
      {style==='baseline'&&display.slice(1).map((c,i)=><line key={i} x1={x(i)} y1={y(display[i].close)} x2={x(i+1)} y2={y(c.close)} stroke={c.close>=baseline?'#72e2c7':'#ff9cb7'} strokeWidth="2.8"/>)}
      {style==='markers'&&display.map((c,i)=><circle key={i} cx={x(i)} cy={y(c.close)} r="2.5" fill="#e7baff"/>)}
      {style==='baseline'&&<line x1={L} x2={W-R} y1={y(baseline)} y2={y(baseline)} stroke="#bd8bdb" strokeDasharray="4 5"/>}
      {indicators.ma7&&<path d={valuePath(ma7,y)} fill="none" stroke="#ffd477" strokeWidth="2.3"/>}
      {indicators.ma25&&<path d={valuePath(ma25,y)} fill="none" stroke="#7bbaff" strokeWidth="2.3"/>}
      {indicators.ma7&&<text x={L+5} y={T+14} fill="#ffd477" fontSize="11">MA 7</text>}{indicators.ma25&&<text x={L+52} y={T+14} fill="#7bbaff" fontSize="11">MA 25</text>}
      {stop!==null&&style!=='heikin'&&<g><line x1={L} x2={W-R} y1={y(stop)} y2={y(stop)} stroke="#d8a675" strokeDasharray="7 6"/><text x={W-R+16} y={y(stop)-7} fill="#e4ae7b" fontSize="11">STOP</text></g>}
      {referencePrice!==undefined&&style!=='heikin'&&<line x1={L} x2={W-R} y1={y(referencePrice)} y2={y(referencePrice)} stroke="#d7acff" strokeDasharray="3 5"/>}
      {hasVolume&&<g><line x1={L} x2={W-R+8} y1={volumeBottom} y2={volumeBottom} stroke="#a874c07d"/><text x={L+5} y={volumeTop+13} fill="#c8b0d8" fontSize="11">VOLUME</text>{display.map((c,i)=>c.volume===undefined?null:<rect key={`v-${i}`} x={x(i)-candleWidth/2} y={volumeBottom-(c.volume/maxVolume)*50} width={Math.max(1,candleWidth)} height={(c.volume/maxVolume)*50} fill={c.close>=c.open?'#72e2c7a8':'#ff9cb7a8'}/>)}<text x={W-R+16} y={volumeTop+14} fill="#c8b0d8" fontSize="11">{new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(maxVolume)}</text></g>}
      {indicators.macd&&<g><text x={L+5} y={macdTop+13} fill="#c8b0d8" fontSize="11">MACD 12, 26, 9</text><line x1={L} x2={W-R+8} y1={macdZero} y2={macdZero} stroke="#bd9fcd77" strokeDasharray="3 5"/><line x1={L} x2={W-R+8} y1={macdBottom} y2={macdBottom} stroke="#a874c07d"/>{macdSeries.histogram.map((value,i)=>value===null?null:<rect key={i} x={x(i)-candleWidth/2} y={Math.min(macdZero,macdY(value))} width={Math.max(1,candleWidth)} height={Math.max(1,Math.abs(macdZero-macdY(value)))} fill={value>=0?'#73dfbd99':'#f39abc99'}/>)}<path d={valuePath(macdSeries.line,macdY)} fill="none" stroke="#d9adff" strokeWidth="2"/><path d={valuePath(macdSeries.signal,macdY)} fill="none" stroke="#ffd477" strokeWidth="2"/></g>}
      {indicators.rsi&&<g><text x={L+5} y={rsiTop+13} fill="#c8b0d8" fontSize="11">RSI 14</text>{[30,70].map(value=><line key={value} x1={L} x2={W-R+8} y1={rsiY(value)} y2={rsiY(value)} stroke="#a989bd88" strokeDasharray="3 5"/>)}<path d={valuePath(rsiSeries,rsiY)} fill="none" stroke="#c792f5" strokeWidth="2.2"/><text x={W-R+16} y={rsiY(70)+4} fill="#c8b0d8" fontSize="11">70</text><text x={W-R+16} y={rsiY(30)+4} fill="#c8b0d8" fontSize="11">30</text><line x1={L} x2={W-R+8} y1={rsiBottom} y2={rsiBottom} stroke="#a874c07d"/></g>}
      {fills.filter(fill=>fill.time>=display[0].time&&fill.time<=display.at(-1)!.time+(display[1]?.time-display[0].time||900)).map(fill=>{const index=Math.max(0,Math.min(display.length-1,Math.floor((fill.time-display[0].time)/(display[1]?.time-display[0].time||900))));const yy=fill.side==='buy'?y(display[index].low)+16:y(display[index].high)-15;return <g key={fill.id}><circle cx={x(index)} cy={yy} r="9" fill={fill.side==='buy'?'#8d7cff':'#e780b5'}/><text x={x(index)} y={yy+3} textAnchor="middle" fill="#fff" fontSize="9">{fill.side==='buy'?'B':'S'}</text></g>;})}
      {current&&<g><line x1={x(hover!)} x2={x(hover!)} y1={T} y2={plotBottom} stroke="#d9b6ee" strokeDasharray="3 4"/><circle cx={x(hover!)} cy={y(current.close)} r="5" fill="#f1d9ff"/></g>}
      <line x1={L} x2={W-R+8} y1={H-B} y2={H-B} stroke="#a874c07d"/>
    </svg>
    {current&&<div className="chart-hover" aria-live="off"><strong>{stamp(current.time,locale)} UTC</strong><span>O {priceLabel(current.open,locale)} · H {priceLabel(current.high,locale)} · L {priceLabel(current.low,locale)} · C {priceLabel(current.close,locale)}</span>{current.volume!==undefined&&<span>Volume {new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:2}).format(current.volume)}</span>}</div>}
  </div>;
}
