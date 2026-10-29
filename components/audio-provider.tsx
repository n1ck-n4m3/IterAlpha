'use client';
import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {DEFAULT_AUDIO, readAudioSettings, SpiderAudio, type AudioSettings} from '../lib/spider/audio';
import {AUDIO_COPY as C} from '../lib/audio-copy';
type AudioState = AudioSettings & {ready: boolean; busy: boolean; error: string; toggle: (kind: 'effects' | 'music') => Promise<void>; preview: () => Promise<void>; setVolume: (value: number) => void};
const AudioContext = createContext<AudioState | null>(null);
const STORAGE = 'iteralpha_audio_v1';
export function AudioProvider({children}: {children: React.ReactNode}) {
  const engine = useRef<SpiderAudio | null>(null), settings = useRef<AudioSettings>({...DEFAULT_AUDIO}), pending = useRef(false);
  const [value, setValue] = useState<AudioSettings>({...DEFAULT_AUDIO}), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = useCallback((next: AudioSettings) => {settings.current = next; setValue(next); try {localStorage.setItem(STORAGE, JSON.stringify(next));} catch {}}, []);
  useEffect(() => {
    const audio = new SpiderAudio(); engine.current = audio;
    try {settings.current = readAudioSettings(localStorage.getItem(STORAGE), localStorage.getItem('iteralpha_volume'));} catch {}
    audio.setVolume(settings.current.volume); audio.effects = settings.current.effects; audio.music = settings.current.music; setValue(settings.current);
    const activate = () => {if (!pending.current && !audio.running && (settings.current.effects || settings.current.music)) void audio.resume().then(() => setReady(audio.running)).catch(() => {setReady(false); setError(C.blocked);});};
    const onCue = (event: Event) => {const kind = (event as CustomEvent).detail; if (['buy', 'sell', 'hold', 'pause', 'resume'].includes(kind)) audio.cue(kind);};
    const onClick = (event: MouseEvent) => {if ((event.target as Element).closest('button:not(:disabled), a, select') && !(event.target as Element).closest('.ia-audio')) audio.cue('click');};
    const onVisibility = () => {if (document.hidden) {setReady(false); void audio.suspend().catch(() => setError(C.blocked));} else void audio.resume().then(() => setReady(audio.running)).catch(() => {setReady(false); setError(C.blocked);});};
    document.addEventListener('pointerdown', activate); document.addEventListener('keydown', activate); window.addEventListener('iteralpha:audio', onCue); document.addEventListener('click', onClick); document.addEventListener('visibilitychange', onVisibility);
    return () => {engine.current = null; audio.destroy(); document.removeEventListener('pointerdown', activate); document.removeEventListener('keydown', activate); window.removeEventListener('iteralpha:audio', onCue); document.removeEventListener('click', onClick); document.removeEventListener('visibilitychange', onVisibility);};
  }, []);
  async function interact(kind: 'effects' | 'music' | 'preview') {
    const audio = engine.current; if (!audio || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const next = {...settings.current};
      if (kind !== 'preview') next[kind] = !next[kind];
      const needsAudio = kind === 'preview' || next.effects || next.music;
      if (needsAudio) await audio.unlock();
      audio.effects = next.effects; audio.setMusic(next.music); save(next); setReady(audio.running);
      if (kind === 'preview' || kind === 'effects' && next.effects) audio.cue('buy', true);
      if (!needsAudio) {await audio.suspend(); setReady(false);}
    } catch {setError(C.blocked); setReady(false);} finally {pending.current = false; setBusy(false);}
  }
  return <AudioContext.Provider value={{...value, ready, busy, error, toggle: kind => interact(kind), preview: () => interact('preview'), setVolume: volume => {engine.current?.setVolume(volume); save({...settings.current, volume});}}}>{children}</AudioContext.Provider>;
}
export function useAudio() {const context = useContext(AudioContext); if (!context) throw new Error('Sound controls require an audio provider.'); return context;}
