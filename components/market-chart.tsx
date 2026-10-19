'use client';
import { useEffect, useRef } from 'react';
import { AreaSeries, BarSeries, BaselineSeries, CandlestickSeries, ColorType, createChart, createSeriesMarkers, HistogramSeries, LineSeries, LineStyle, LineType, type IPriceLine, type ISeriesApi, type SeriesType, type UTCTimestamp } from 'lightweight-charts';
import type { Candle, Fill } from '../lib/training/types';

export type ChartStyle = 'candles' | 'hollow' | 'bars' | 'highlow' | 'line' | 'markers' | 'step' | 'area' | 'baseline' | 'heikin';
export const chartStyles: {value: ChartStyle; label: string}[] = [
  {value:'candles',label:'Candles'},{value:'hollow',label:'Hollow candles'},{value:'bars',label:'OHLC bars'},{value:'highlow',label:'HLC bars'},
  {value:'line',label:'Line'},{value:'markers',label:'Line with markers'},{value:'step',label:'Step line'},
  {value:'area',label:'Area'},{value:'baseline',label:'Baseline'},{value:'heikin',label:'Heikin Ashi'}
];
export function heikinAshi(candles: Candle[]): Candle[] {
  let priorOpen=0;let priorClose=0;
  return candles.map((c,index)=>{
    const close=(c.open+c.high+c.low+c.close)/4;
    const open=index===0?(c.open+c.close)/2:(priorOpen+priorClose)/2;
    priorOpen=open;priorClose=close;
    return {...c,open,close,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close)};
  });
}
export default function MarketChart({candles,fills,stop,revision,style='candles',training=true,referencePrice}:{candles:Candle[];fills:Fill[];stop:number|null;revision:string;style?:ChartStyle;training?:boolean;referencePrice?:number}) {
  const container=useRef<HTMLDivElement>(null);
  const seriesRef=useRef<ISeriesApi<SeriesType>|null>(null);
  const liveLine=useRef<IPriceLine|null>(null);
  useEffect(()=>{
    if(!container.current||!candles.length)return;
    const chart=createChart(container.current,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#15121d'},textColor:'#9892a8',fontFamily:'Arial, sans-serif',fontSize:11,attributionLogo:true},grid:{vertLines:{color:'#25212e'},horzLines:{color:'#25212e'}},crosshair:{mode:0,vertLine:{color:'#776f8a',labelBackgroundColor:'#383047'},horzLine:{color:'#776f8a',labelBackgroundColor:'#383047'}},rightPriceScale:{borderColor:'#302a3a',scaleMargins:{top:0.12,bottom:0.24}},timeScale:{borderColor:'#302a3a',timeVisible:true,secondsVisible:false,rightOffset:5},handleScroll:{vertTouchDrag:false},localization:{locale:'en-US'}});
    const priceFormat={type:'price' as const,precision:2,minMove:0.01};
    const lineData=candles.map(c=>({time:c.time as UTCTimestamp,value:c.close}));
    const ohlcData=(style==='heikin'?heikinAshi(candles):candles).map(c=>({...c,time:c.time as UTCTimestamp}));
    let series: ISeriesApi<SeriesType>;
    if(style==='line'||style==='markers'||style==='step') {const item=chart.addSeries(LineSeries,{color:'#b597ff',lineWidth:2,pointMarkersVisible:style==='markers',lineType:style==='step'?LineType.WithSteps:LineType.Simple,priceFormat});item.setData(lineData);series=item as ISeriesApi<SeriesType>;}
    else if(style==='area') {const item=chart.addSeries(AreaSeries,{lineColor:'#b597ff',topColor:'#8056c788',bottomColor:'#8056c708',lineWidth:2,priceFormat});item.setData(lineData);series=item as ISeriesApi<SeriesType>;}
    else if(style==='baseline') {const item=chart.addSeries(BaselineSeries,{baseValue:{type:'price',price:candles[0].close},topLineColor:'#65c7ac',bottomLineColor:'#dd7e9a',priceFormat});item.setData(lineData);series=item as ISeriesApi<SeriesType>;}
    else if(style==='bars'||style==='highlow') {const item=chart.addSeries(BarSeries,{upColor:'#65c7ac',downColor:'#dd7e9a',openVisible:style==='bars',priceFormat});item.setData(ohlcData);series=item as ISeriesApi<SeriesType>;}
    else {const item=chart.addSeries(CandlestickSeries,{upColor:style==='hollow'?'#15121d':'#65c7ac',downColor:'#dd7e9a',wickUpColor:'#65c7ac',wickDownColor:'#dd7e9a',borderVisible:style==='hollow',borderUpColor:'#65c7ac',borderDownColor:'#dd7e9a',priceFormat});item.setData(ohlcData);series=item as ISeriesApi<SeriesType>;}
    seriesRef.current=series;
    if(candles.every(c=>c.volume!==undefined)){
      const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false});volume.priceScale().applyOptions({scaleMargins:{top:0.85,bottom:0}});
      volume.setData(candles.map(c=>({time:c.time as UTCTimestamp,value:c.volume!,color:c.close>=c.open?'#65c7ac26':'#dd7e9a26'})));
    }
    if(stop&&style!=='heikin')series.createPriceLine({price:stop,color:'#dcaa7b',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:'Stop'});
    const interval=candles.length>1?candles[1].time-candles[0].time:900;
    const markers=fills.filter(f=>f.time>=candles[0].time&&f.time<=candles[candles.length-1].time+interval).map(f=>({time:Math.min(candles[candles.length-1].time,Math.floor(f.time/interval)*interval) as UTCTimestamp,position:(f.side==='buy'?'belowBar':'aboveBar') as 'belowBar'|'aboveBar',color:f.side==='buy'?'#b894ff':'#ed8da4',shape:(f.side==='buy'?'arrowUp':'arrowDown') as 'arrowUp'|'arrowDown',text:f.reason==='stop'?'Stop':f.reason==='end'?'End':f.side==='buy'?'Buy':'Sell'})).sort((a,b)=>a.time-b.time);
    createSeriesMarkers(series,markers);chart.timeScale().fitContent();return()=>{seriesRef.current=null;liveLine.current=null;chart.remove();};
  },[candles,fills,stop,revision,style]);
  useEffect(()=>{if(!referencePrice||style==='heikin'||!seriesRef.current)return;if(liveLine.current)liveLine.current.applyOptions({price:referencePrice});else liveLine.current=seriesRef.current.createPriceLine({price:referencePrice,color:'#b597ff',lineWidth:1,lineStyle:LineStyle.Dotted,axisLabelVisible:true,title:'Last trade'});},[referencePrice,style,revision,candles]);
  return <div ref={container} className="market-chart" role="img" aria-label={`${style} chart with ${candles.length} visible bars. Last actual close ${candles.at(-1)?.close.toFixed(2)} dollars.${training?' Future prices are hidden until a decision is saved.':''}`}/>;
}
