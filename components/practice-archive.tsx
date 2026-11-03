'use client';
import LocalizedContent from './localized-content';



import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,BookOpen,Download,X} from 'lucide-react';
import type {HistoryItem,SessionView} from '../lib/training/types';
import {ARCHIVE_COPY as C} from '../lib/archive-copy';
import {useLocale} from './locale-provider';

type Archive={history:HistoryItem[]};
async function read<T>(path:string):Promise<T>{const response=await fetch(path,{credentials:'same-origin'});if(!response.ok)throw new Error(C.unavailable);return response.json() as Promise<T>;}
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function PracticeArchive({onAgent}:{onAgent:()=>void}){
  const {locale}=useLocale(),[archive,setArchive]=useState<Archive|null>(null),[record,setRecord]=useState<SessionView|null>(null),[filter,setFilter]=useState('all'),[error,setError]=useState(''),[busy,setBusy]=useState(false),dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{let active=true;void read<Archive>('/api/bootstrap').then(value=>{if(active)setArchive(value);}).catch(()=>{if(active)setError(C.unavailable);});return()=>{active=false;};},[]);
  useEffect(()=>{if(record&&!dialog.current?.open)dialog.current?.showModal();else if(!record)dialog.current?.close();},[record]);
  const number=(n:number,digits=2)=>new Intl.NumberFormat(locale,{maximumFractionDigits:digits}).format(n);
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric'}).format(new Date(value));
  async function open(id:string){if(busy)return;setBusy(true);setError('');try{setRecord(await read<SessionView>(`/api/sessions/${id}`));}catch{setError(C.unavailable);}finally{setBusy(false);}}
  const rows=archive?.history.filter(item=>filter==='all'||item.status===filter)??[];
  return <LocalizedContent>{<section className="practice-archive">
    <div className="workspace-archive-banner"><BookOpen size={17}/><div><strong>{C.title}</strong><p>{C.notice}</p></div><button onClick={onAgent}>{C.openAgent}<ArrowUpRight size={13}/></button></div>
    <div className="page-heading"><div><h1>{C.title}</h1><p>{C.intro}</p></div><button className="quiet-button" disabled={!archive} onClick={()=>download({scope:'Archived practice records',...archive},'iteralpha-practice-archive.json')}><Download size={14}/>{C.exportAll}</button></div>
    {error&&<p role="alert" className="field-error">{error}</p>}
    <div className="review-toolbar"><div className="filter-control">{(['all','completed','active'] as const).map(value=><button key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{C[value]}</button>)}</div><span>{C.synthetic}</span></div>
    {!archive&&!error?<p role="status">{C.loading}</p>:<section className="journal-panel"><div className="journal-header"><span>{C.savedRound}</span><span>{C.decisions}</span><span>{C.result}</span><span>{C.status}</span><span/></div>{rows.map(item=><button className="journal-row" key={item.id} disabled={busy} onClick={()=>void open(item.id)}><span className="journal-title"><span className="mini-coin">{item.asset==='BTC'?'₿':'Ξ'}</span><span><strong>{item.asset} · {C.savedRound}</strong><small>{date(item.updatedAt)}</small></span></span><span>{number(item.decisions,0)}</span><span className={item.netPnl>=0?'positive':'negative'}>{item.netPnl>=0?'+':''}{number(item.netPnl)} USD</span><span className="status-chip">{C[item.status]}</span><span>{C.view}<ArrowUpRight size={12}/></span></button>)}{!rows.length&&<div className="empty-state"><BookOpen/><h2>{C.empty}</h2><p>{C.emptyDetail}</p><button className="primary" onClick={onAgent}>{C.openAgent}</button></div>}</section>}
    <p className="page-note">{C.exportScope}</p>
    <dialog ref={dialog} className="archive-record-dialog" onCancel={()=>setRecord(null)} onClick={event=>{if(event.currentTarget===event.target)setRecord(null);}} aria-label={C.savedRound}>
      <header><span>{C.readonly} · {C.synthetic}</span><button aria-label={C.close} onClick={()=>setRecord(null)}><X size={18}/></button></header>
      {record&&<><h2>{record.scene.asset} · {C.savedRound}</h2><p>{date(record.updatedAt)}</p><div className="archive-record-stats">{[[C.starting,record.account.initialCash],[C.equity,record.account.equity],[C.cash,record.account.cash],[C.fees,record.outcome?.fees??record.fills.reduce((sum,fill)=>sum+fill.fee,0)]] .map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{number(Number(value))} USD</strong></div>)}</div><div className="archive-record-table"><table><thead><tr><th>{C.time}</th><th>{C.action}</th><th>{C.spent}</th><th>{C.price}</th><th>{C.quantity}</th></tr></thead><tbody>{record.decisions.map(decision=><tr key={decision.id}><td>{new Date(decision.time*1000).toISOString().slice(11,19)} UTC</td><td>{C[decision.input.action]}</td><td>{decision.actualSpent===undefined?'—':number(decision.actualSpent)}</td><td>{number(decision.referencePrice)}</td><td>{number(decision.quantityAfter,8)}</td></tr>)}</tbody></table>{!record.decisions.length&&<p>{C.noDecisions}</p>}</div>{record.decisions.filter(decision=>decision.input.thesis).map(decision=><blockquote key={decision.id}><strong>{C.note}</strong><p data-i18n="source">{decision.input.thesis}</p></blockquote>)}<button className="quiet-button" onClick={()=>download(record,`practice-${record.id}.json`)}><Download size={13}/>{C.exportRecord}</button></>}
    </dialog>
  </section>}</LocalizedContent>;
}
