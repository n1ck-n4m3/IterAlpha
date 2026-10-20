'use client';

import {useEffect} from 'react';

const selectable='button, a, summary, input[type="range"], select';
const glowable='[data-glow], .chart-panel, .decision-panel, .play-card, .journal-row, .progress-stats > div, .market-direct, .live-widget-panel, .practice-map, .learning-notes';

export default function InteractionEffects(){
  useEffect(()=>{
    let frame=0;
    const onMove=(event:PointerEvent)=>{
      if(event.pointerType==='touch')return;
      const element=event.target instanceof Element?event.target.closest(glowable):null;
      if(!(element instanceof HTMLElement)||!element.closest('[data-interactive-surface]'))return;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const rect=element.getBoundingClientRect();
        element.style.setProperty('--hover-x',`${event.clientX-rect.left}px`);
        element.style.setProperty('--hover-y',`${event.clientY-rect.top}px`);
      });
    };
    const pulse=(target:EventTarget|null,x:number,y:number)=>{
      if(!(target instanceof Element)||!target.closest('[data-interactive-surface]'))return;
      const control=target.closest(selectable);
      if(!(control instanceof HTMLElement)||control.matches(':disabled'))return;
      const mark=document.createElement('span');
      mark.className='interaction-pulse';
      mark.style.left=`${x}px`;
      mark.style.top=`${y}px`;
      if(control.closest('.sell,.negative'))mark.dataset.tone='rose';
      document.body.appendChild(mark);
      const fallback=window.setTimeout(()=>mark.remove(),700);
      mark.addEventListener('animationend',()=>{window.clearTimeout(fallback);mark.remove();},{once:true});
    };
    const onPointerDown=(event:PointerEvent)=>{if(event.button===0)pulse(event.target,event.clientX,event.clientY);};
    const onKeyboardClick=(event:MouseEvent)=>{
      if(event.detail!==0||!(event.target instanceof Element))return;
      const rect=event.target.getBoundingClientRect();
      pulse(event.target,rect.left+rect.width/2,rect.top+rect.height/2);
    };
    document.addEventListener('pointermove',onMove,{passive:true});
    document.addEventListener('pointerdown',onPointerDown,{passive:true});
    document.addEventListener('click',onKeyboardClick);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('click',onKeyboardClick);};
  },[]);
  return null;
}
