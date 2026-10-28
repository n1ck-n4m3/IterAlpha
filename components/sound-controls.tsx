'use client';
import {useEffect, useRef, useState} from 'react';
import {Music2, Volume2, VolumeX, X} from 'lucide-react';
import {AUDIO_COPY as C} from '../lib/audio-copy';
import {SpiderAudio} from '../lib/spider/audio';
export default function SoundControls() {
  const audio = useRef<SpiderAudio | null>(null), panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [effects, setEffects] = useState(false), [music, setMusic] = useState(false), [volume, setVolume] = useState(.25);
  useEffect(() => {const engine = new SpiderAudio(); audio.current = engine; let frame = 0;
    try {const saved = Number(localStorage.getItem('iteralpha_volume')); if (saved > 0 && saved <= 1) {engine.setVolume(saved); frame = requestAnimationFrame(() => setVolume(saved));}} catch {}
    const onCue = (event: Event) => {const kind = (event as CustomEvent).detail; if (['buy', 'sell', 'hold', 'pause', 'resume'].includes(kind)) engine.cue(kind);};
    const onClick = (event: MouseEvent) => {if ((event.target as Element).closest('button, a, select, input[type="range"]')) engine.cue('click');};
    const onVisibility = () => {if (document.hidden) void engine.suspend(); else void engine.resume();};
    window.addEventListener('iteralpha:audio', onCue); document.addEventListener('click', onClick); document.addEventListener('visibilitychange', onVisibility);
    return () => {cancelAnimationFrame(frame); engine.destroy(); window.removeEventListener('iteralpha:audio', onCue); document.removeEventListener('click', onClick); document.removeEventListener('visibilitychange', onVisibility);};
  }, []);
  useEffect(() => {if (!open) return; const close = (event: PointerEvent) => {if (!panel.current?.contains(event.target as Node)) setOpen(false);}; const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') setOpen(false);}; document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape); return () => {document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape);};}, [open]);
  async function toggle(kind: 'effects' | 'music') {const engine = audio.current; if (!engine) return; await engine.unlock(); if (kind === 'effects') {engine.effects = !effects; setEffects(!effects); engine.cue('resume');} else {engine.setMusic(!music); setMusic(!music);}}
  return <div className="ia-audio" ref={panel}><button className={`ia-audio-trigger ${effects || music ? 'on' : ''}`} type="button" aria-label={C.settings} aria-expanded={open} onClick={() => setOpen(!open)}>{music ? <span className="ia-equalizer" aria-hidden="true"><i/><i/><i/><i/></span> : effects ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>{open && <div className="ia-audio-panel"><div><strong>{C.title}</strong><button aria-label={C.close} onClick={() => setOpen(false)}><X size={14}/></button></div><button className="ia-audio-option" role="switch" aria-checked={effects} onClick={() => void toggle('effects')}><span><Volume2 size={14}/>{C.effects}</span><i className={effects ? 'on' : ''}><b/></i></button><button className="ia-audio-option" role="switch" aria-checked={music} onClick={() => void toggle('music')}><span><Music2 size={14}/>{C.music}</span><i className={music ? 'on' : ''}><b/></i></button><label>{C.volume}<span>{Math.round(volume * 100)}%</span><input aria-label={C.volume} type="range" min="0" max="1" step=".01" value={volume} onChange={event => {const value = Number(event.target.value); setVolume(value); audio.current?.setVolume(value); try {localStorage.setItem('iteralpha_volume', String(value));} catch {}}}/></label><p>{C.note}</p></div>}</div>;
}
