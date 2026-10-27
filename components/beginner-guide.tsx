'use client';
import { useState } from 'react';
import { BookOpen, ChevronDown, Sparkles } from 'lucide-react';
import { LEARNING_COPY as C } from '../lib/learning-copy';

export default function BeginnerGuide({defaultOpen = true}: {defaultOpen?: boolean}) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`beginner-guide ${open ? 'open' : ''}`} aria-label={C.tutorial.aria}>
    <button className="beginner-guide-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="beginner-guide-icon"><BookOpen size={17}/></span>
      <span><small>{C.tutorial.eyebrow}</small><strong>{C.tutorial.title}</strong></span>
      <span className="beginner-guide-toggle-label">{open ? C.tutorial.hide : C.tutorial.show}<ChevronDown size={15}/></span>
    </button>
    {open && <div className="beginner-guide-body">
      {C.tutorial.steps.map((step, index) => <div className="beginner-guide-step" key={step.title}>
        <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.body}</p></div>
      </div>)}
      <p className="beginner-guide-note"><Sparkles size={13}/>{C.tutorial.note}</p>
    </div>}
  </section>;
}
