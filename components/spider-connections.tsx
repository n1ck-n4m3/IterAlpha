'use client';
import LocalizedContent from './localized-content';



import {useEffect,useState} from 'react';
import ExchangeCoverage from './exchange-coverage';
import {spiderRequest} from '../lib/spider/client';
import {CONNECTION_COPY as C} from '../lib/spider/connection-copy';
type Status={execution:string;model:'not-connected'|'shadow-configured';modelControlsOrders:boolean;trainingWorker:string;realOrders:boolean};
export default function SpiderConnections(){
  const [status,setStatus]=useState<Status|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;void spiderRequest<Status>('/api/spider/capabilities').then(value=>{if(active)setStatus(value);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[]);
  return <LocalizedContent>{<><div className="sa-connections"><h3>{C.title}</h3><dl><div><dt>{C.execution}</dt><dd>{status?C.rules:failed?C.unavailable:C.loading}</dd></div><div><dt>{C.model}</dt><dd>{status?status.model==='shadow-configured'?C.shadow:C.disconnected:'—'}</dd></div><div><dt>{C.training}</dt><dd>{status?C.notConfigured:'—'}</dd></div><div><dt>{C.orders}</dt><dd>{status?C.disabled:'—'}</dd></div></dl><p>{C.note}</p></div><ExchangeCoverage defaultOpen/></>}</LocalizedContent>;
}
