export type AudioSettings = {effects: boolean; music: boolean; volume: number};
export const DEFAULT_AUDIO: AudioSettings = {effects: false, music: false, volume: .4};
export function readAudioSettings(value: string | null, legacyVolume?: string | null): AudioSettings {
  try {
    const saved = value ? JSON.parse(value) : {}, volume = saved.volume ?? (legacyVolume === null || legacyVolume === undefined ? DEFAULT_AUDIO.volume : Number(legacyVolume));
    return {effects: saved.effects === true, music: saved.music === true, volume: typeof volume === 'number' && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : DEFAULT_AUDIO.volume};
  } catch {return {...DEFAULT_AUDIO};}
}
/** One audio engine per document. All sound is original procedural synthesis. */
export class SpiderAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private voices = new Map<OscillatorNode, {envelope: GainNode; music: boolean}>();
  private factory: () => AudioContext;
  effects = false;
  music = false;
  volume = DEFAULT_AUDIO.volume;
  constructor(factory?: () => AudioContext) {
    this.factory = factory ?? (() => {
      const Audio = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Audio) throw new Error('Audio is not supported in this browser.');
      return new Audio();
    });
  }
  get running() {return this.context?.state === 'running';}
  async unlock() {
    if (!this.context || this.context.state === 'closed') {
      this.context = this.factory(); this.master = this.context.createGain(); this.master.gain.value = this.volume; this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain(); this.musicGain.gain.value = .35; this.musicGain.connect(this.master);
    }
    if (this.context.state !== 'running') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {await Promise.race([this.context.resume(), new Promise<never>((_resolve, reject) => {timer = setTimeout(() => reject(new Error('The browser did not enable audio in time.')), 2500);})]);}
      finally {if (timer) clearTimeout(timer);}
    }
    if (!this.running) throw new Error('The browser has not enabled audio yet.');
  }
  setVolume(volume: number) {if (!Number.isFinite(volume)) return; this.volume = Math.max(0, Math.min(1, volume)); if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .05);}
  private stopVoices(musicOnly = false) {
    for (const [voice, value] of this.voices) {
      if (musicOnly && !value.music) continue;
      voice.onended = null; try {voice.stop();} catch {} voice.disconnect(); value.envelope.disconnect(); this.voices.delete(voice);
    }
  }
  private tone(frequency: number, offset: number, duration: number, gain: number, music = false) {
    const context = this.context; if (!context || !this.running || !this.master || !this.musicGain) return;
    const oscillator = context.createOscillator(), envelope = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const start = context.currentTime + offset; envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(gain, start + (music ? 1.2 : .012)); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    this.voices.set(oscillator, {envelope, music});
    oscillator.connect(envelope); envelope.connect(music ? this.musicGain : this.master); oscillator.onended = () => {this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect();}; oscillator.start(start); oscillator.stop(start + duration + .05);
  }
  cue(kind: 'buy' | 'sell' | 'hold' | 'pause' | 'resume' | 'click', preview = false) {
    if (!this.effects && !preview) return;
    const notes = kind === 'buy' ? [440, 554.37, 659.25] : kind === 'sell' ? [659.25, 523.25, 440] : kind === 'pause' ? [329.63, 261.63] : kind === 'resume' ? [329.63, 440] : [660];
    notes.forEach((note, i) => this.tone(note, i * .09, kind === 'click' ? .09 : .3, kind === 'click' ? .06 : .14));
  }
  setMusic(enabled: boolean) {
    this.music = enabled;
    if (!enabled) {if (this.timer) clearInterval(this.timer); this.timer = null; this.stopVoices(true); return;}
    if (this.timer || !this.running) return;
    const chords = [[110, 164.81, 220, 261.63, 329.63], [87.31, 130.81, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63, 392], [98, 146.83, 196, 246.94, 293.66]];
    const play = () => {const chord = chords[this.beat++ % chords.length]; chord.forEach((note, i) => this.tone(note, i * .15, 7.6, i === 0 ? .15 : .1, true)); this.tone(chord[3] * 2, 2, 2.8, .06, true); this.tone(chord[4] * 2, 5, 2.5, .04, true);};
    play(); this.timer = setInterval(play, 8000);
  }
  async suspend() {if (this.timer) clearInterval(this.timer); this.timer = null; this.stopVoices(); if (this.context?.state === 'running') await this.context.suspend();}
  async resume() {if (!this.music && !this.effects) return; await this.unlock(); this.setMusic(this.music);}
  destroy() {if (this.timer) clearInterval(this.timer); this.timer = null; this.stopVoices(); const context = this.context; this.context = null; this.master = null; this.musicGain = null; if (context && context.state !== 'closed') void context.close().catch(() => {});}
}
