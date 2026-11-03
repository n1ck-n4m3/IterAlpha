'use client';
import LocalizedContent from './localized-content';



import {useEffect,useState} from 'react';
import {BookOpen,Ellipsis,House} from 'lucide-react';
import {appRoute,readAppRoute,type AppView} from '../lib/app-navigation';
import {WORKSPACE_COPY as C} from '../lib/workspace-copy';
import SpiderDesk from './spider-desk';
import PracticeArchive from './practice-archive';
import SoundControls from './sound-controls';
import AccountLinks,{type Viewer} from './account-links';
import {LanguageSwitcher} from './locale-provider';

export default function TrainingApp({viewer,initialView='spider',initialSpiderMode='easy'}:{viewer:Viewer;initialView?:AppView;initialSpiderMode?:'easy'|'pro'}){
  const [view,setView]=useState<AppView>(initialView);
  useEffect(()=>{const restore=()=>setView(readAppRoute(window.location.search).view);window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent('iteralpha:view',{detail:view}));},[view]);
  function navigate(next:AppView){const url=appRoute(window.location.search,next);window.history.pushState({},'',url);setView(next);}
  return <LocalizedContent>{<div className={`app-shell ${view==='spider'?'spider-shell':'archive-shell'}`} data-interactive-surface>
    <header className="app-header"><a className="brand" href="/" aria-label={C.home}><span className="brand-mark" aria-hidden="true"/><span>IterAlpha<span className="brand-dot">.</span></span></a><nav className="top-nav" aria-label={C.navigation}><a className="app-home-link" href="/" aria-label={C.home}><House size={13}/><span>{C.home}</span></a><button aria-current={view==='spider'?'page':undefined} className={view==='spider'?'active':''} onClick={()=>navigate('spider')}>{C.agent}</button><details className="workspace-more"><summary aria-label={C.moreTools} title={C.moreTools}><Ellipsis size={17}/></summary><div><a href="/app?view=review" aria-label={C.archive}><BookOpen size={15}/><span><b>{C.archive}</b><small>{C.archiveDetail}</small></span></a></div></details></nav><div className="header-right"><SoundControls/><LanguageSwitcher className="training-language"/><AccountLinks viewer={viewer} returnTo="/app" className="training-account"/></div></header>
    <main id="main-content" className="main-content">{view==='spider'?<SpiderDesk initialMode={initialSpiderMode}/>:<PracticeArchive onAgent={()=>navigate('spider')}/>}</main>
  </div>}</LocalizedContent>;
}
