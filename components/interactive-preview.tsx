'use client';
import {useState} from 'react';
import {ArrowRight,Check,LockKeyhole,RotateCcw} from 'lucide-react';
import {LANDING_COPY as C} from '../lib/landing-copy';

type PreviewAction = 'buy' | 'wait';

export default function InteractivePreview(){
  const [action,setAction]=useState<PreviewAction|null>(null);
  return <div className="hero-visual" id="demo" aria-label={C.preview.aria}>
    <div className="preview-window"><div className="preview-bar"><div className="preview-dots"><i/><i/><i/></div><span>{C.preview.room}</span><span className="preview-live"><i/>{C.preview.interactive}</span></div>
      <div className="preview-body"><div className="preview-heading"><div><small>{C.preview.label}</small><h2><span className="preview-coin">₿</span>{C.preview.asset}</h2></div><span>{action?C.preview.review:C.preview.step}</span></div>
        <div className={`preview-chart ${action?'is-revealed':''}`}><div className="preview-grid"/><svg viewBox="0 0 640 210" preserveAspectRatio="none" role="img" aria-label={action?C.preview.chartRevealed:C.preview.chartHidden}><defs><linearGradient id="chartShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a579ff" stopOpacity=".26"/><stop offset="1" stopColor="#a579ff" stopOpacity="0"/></linearGradient></defs><path className="preview-path-fill" d="M0 161 L24 151 45 158 70 138 91 141 113 129 136 135 158 121 178 127 202 98 226 108 251 95 278 109 300 98 324 75 346 89 370 61 394 65 418 92 441 86 463 109 484 101 L484 210 L0 210 Z" fill="url(#chartShade)"/><path className="preview-path-past" d="M0 161 L24 151 45 158 70 138 91 141 113 129 136 135 158 121 178 127 202 98 226 108 251 95 278 109 300 98 324 75 346 89 370 61 394 65 418 92 441 86 463 109 484 101" fill="none" stroke="#b991ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path className="preview-path-future" d="M484 101 L507 124 529 145 551 141 576 164 600 157 625 177 640 171" fill="none" stroke="#d4aaff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="preview-cutoff">{action?<><Check size={11}/> {C.preview.revealed}</>:<><LockKeyhole size={11}/> {C.preview.hidden}</>}</div></div>
        {!action?<div className="preview-decision"><span>{C.preview.nextMove}</span><strong>{C.preview.question}</strong><div className="preview-action-row"><button type="button" onClick={()=>setAction('buy')}>{C.preview.buy}<ArrowRight size={12}/></button><button type="button" onClick={()=>setAction('wait')}>{C.preview.wait}<ArrowRight size={12}/></button></div><small>{C.preview.choose}</small></div>:<div className="preview-decision preview-result" role="status"><span>{C.preview.reviewLabel} · {action==='buy'?'BUY':'WAIT'}</span><strong>{action==='buy'?C.preview.reviewBuy:C.preview.reviewWait}</strong><p>{action==='buy'?C.preview.explainBuy:C.preview.explainWait}</p><button type="button" className="preview-replay" onClick={()=>setAction(null)}><RotateCcw size={12}/>{C.preview.tryAgain}</button></div>}
      </div></div><div className="preview-float"><span>{C.preview.loop}</span></div><p className="preview-caption">{C.preview.caption}</p>
  </div>;
}
