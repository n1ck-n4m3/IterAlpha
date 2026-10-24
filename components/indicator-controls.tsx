'use client';
import {useEffect,useRef,useState} from 'react';
import {DEFAULT_INDICATORS,type ChartIndicators} from './market-chart';
import {useLocale} from './locale-provider';
import type {TranslationKey} from '../lib/locale-copy';

export function useChartIndicators(){
  const [value,setValue]=useState<ChartIndicators>(DEFAULT_INDICATORS);
  const pending=useRef<number|null>(null);
  useEffect(()=>{let saved:ChartIndicators|null=null;try{saved=JSON.parse(localStorage.getItem('iteralpha_chart_indicators')||'null') as ChartIndicators|null;}catch{}if(!saved||typeof saved!=='object')return;pending.current=requestAnimationFrame(()=>{setValue({...DEFAULT_INDICATORS,...saved});pending.current=null;});return()=>{if(pending.current!==null)cancelAnimationFrame(pending.current);};},[]);
  const update=(next:ChartIndicators)=>{if(pending.current!==null){cancelAnimationFrame(pending.current);pending.current=null;}setValue(next);try{localStorage.setItem('iteralpha_chart_indicators',JSON.stringify(next));}catch{}};
  return [value,update] as const;
}

const indicators:{key:keyof ChartIndicators;label:TranslationKey;description:TranslationKey}[]=[
  {key:'ma7',label:'ma7',description:'ma7Tip'},
  {key:'ma25',label:'ma25',description:'ma25Tip'},
  {key:'volume',label:'volume',description:'volumeTip'},
  {key:'macd',label:'macd',description:'macdTip'},
  {key:'rsi',label:'rsi',description:'rsiTip'},
];

export default function IndicatorControls({value,onChange,availableBars,hasVolume,educational=false}:{value:ChartIndicators;onChange:(next:ChartIndicators)=>void;availableBars:number;hasVolume:boolean;educational?:boolean}){
  const {t}=useLocale();
  return <div className="indicator-controls" aria-label={t('indicators')}><span className="indicator-heading">{t('indicators')}</span><div className="indicator-chips">{indicators.map(item=><button key={item.key} type="button" aria-pressed={value[item.key]} className={`indicator-chip ${value[item.key]?'active':''}`} title={t(item.description)} onClick={()=>onChange({...value,[item.key]:!value[item.key]})}>{t(item.label)}</button>)}</div>{educational&&<div className="indicator-lessons">{indicators.filter(item=>value[item.key]).map(item=><span key={item.key}><strong>{t(item.label)}:</strong> {t(item.description)}</span>)}<p className="indicator-hint">{value.macd&&availableBars<34?`${t('macdWarmup')} `:''}{value.rsi&&availableBars<15?`${t('rsiWarmup')} `:''}{value.volume&&!hasVolume?`${t('volumeUnavailable')} `:''}{t('indicatorWarning')}</p></div>}</div>;
}
