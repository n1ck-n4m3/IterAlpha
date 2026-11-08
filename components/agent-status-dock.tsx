'use client';
import Link from './site-link';
import {ArrowUpRight,Pause,Radio} from 'lucide-react';
import {useSpiderRuntime} from './spider-runtime-provider';
import LocalizedContent from './localized-content';
import {SIMPLE} from '../lib/spider/mandates';
import {RUNTIME_COPY as C} from '../lib/spider/runtime-copy';

export default function AgentStatusDock(){
  const {enabled,workspaceVisible,workspaceMode,bot,busy,pendingAction,observing,fresh,command,error}=useSpiderRuntime();
  if(!enabled||workspaceVisible||!bot)return null;
  const running=bot.status==='running';
  return <LocalizedContent><aside className={`agent-status-dock ${running?'is-running':'is-paused'}`} aria-label={C.title}>
    <span className={`agent-dock-orb ${observing?'is-checking':''}`} aria-hidden="true"><Radio size={20}/></span>
    <div className="agent-dock-summary"><strong>{running?fresh?C.running:SIMPLE.offline:SIMPLE.paused}</strong><span><b data-i18n="source">{bot.config.market.base} / {bot.config.market.quote}</b><i>·</i><b>{bot.cycleCount??bot.cycles?.length??0}</b> {SIMPLE.checks}</span><small>{running?C.scope:bot.quantity?SIMPLE.pausedOpen:SIMPLE.pausedFlat}</small></div>
    <div className="agent-dock-actions">{running&&<button type="button" aria-label={SIMPLE.pause} disabled={busy} onClick={()=>void command('pause')}><Pause size={16}/><span>{pendingAction==='pause'?SIMPLE.pending:SIMPLE.pause}</span></button>}<Link href={`/app?view=spider&mode=${workspaceMode}`} aria-label={C.open}><span>{C.open}</span><ArrowUpRight size={17}/></Link></div>
    {error&&<p className="agent-dock-feedback" role="alert">{error}</p>}
  </aside></LocalizedContent>;
}
