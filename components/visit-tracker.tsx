'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

const pages=new Set(['training','market','review','progress']);
function pageForPath(pathname:string){
  if(pathname==='/')return 'home';
  if(pathname==='/app'){
    const view=new URLSearchParams(window.location.search).get('view');
    return view&&pages.has(view)?view:'training';
  }
  return null;
}
function record(page:string){
  void fetch('/api/visit',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-IterAlpha-Request':'1'},body:JSON.stringify({page})}).catch(()=>{});
}
export default function VisitTracker(){
  const pathname=usePathname();
  useEffect(()=>{
    const page=pageForPath(pathname);
    if(page)record(page);
    const onView=(event:Event)=>{const view=(event as CustomEvent<string>).detail;if(pages.has(view))record(view);};
    window.addEventListener('iteralpha:view',onView);
    return()=>window.removeEventListener('iteralpha:view',onView);
  },[pathname]);
  return null;
}
