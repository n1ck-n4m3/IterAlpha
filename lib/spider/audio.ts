/** Original procedural audio. No recordings or external audio services are used. */
export class SpiderAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private musicVoices = new Set<OscillatorNode>();
  effects = false;
  music = false;
  volume = .25;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.volume; this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain(); this.musicGain.gain.value = .12; this.musicGain.connect(this.master);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setVolume(volume: number) {this.volume = Math.max(0, Math.min(1, volume)); if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .1);}
  private tone(frequency: number, offset: number, duration: number, gain: number, music = false) {
    const context = this.context; if (!context || context.state !== 'running' || !this.master || !this.musicGain) return;
    const oscillator = context.createOscillator(), envelope = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const start = context.currentTime + offset; envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(gain, start + (music ? 1.2 : .012)); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    if (music) this.musicVoices.add(oscillator);
    oscillator.connect(envelope); envelope.connect(music ? this.musicGain : this.master); oscillator.start(start); oscillator.stop(start + duration + .05); oscillator.onended = () => {this.musicVoices.delete(oscillator); oscillator.disconnect(); envelope.disconnect();};
  }
  cue(kind: 'buy' | 'sell' | 'hold' | 'pause' | 'resume' | 'click') {
    if (!this.effects) return;
    const notes = kind === 'buy' ? [440, 554.37, 659.25] : kind === 'sell' ? [659.25, 523.25, 440] : kind === 'pause' ? [329.63, 261.63] : kind === 'resume' ? [329.63, 440] : [660];
    notes.forEach((note, i) => this.tone(note, i * .07, kind === 'click' ? .07 : .24, kind === 'click' ? .025 : .055));
  }
  setMusic(enabled: boolean) {
    this.music = enabled; if (this.timer) clearInterval(this.timer); this.timer = null;
    if (!this.context || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(enabled ? .12 : 0, this.context.currentTime, .4);
    if (!enabled) return;
    const chords = [[110, 164.81, 220, 261.63, 329.63], [87.31, 130.81, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63, 392], [98, 146.83, 196, 246.94, 293.66]];
    const play = () => {const chord = chords[this.beat++ % chords.length]; chord.forEach((note, i) => this.tone(note, i * .15, 7.8, i === 0 ? .15 : .07, true)); this.tone(chord[3] * 2, 2, 2.8, .035, true); this.tone(chord[4] * 2, 5, 2.5, .025, true);};
    play(); this.timer = setInterval(play, 8000);
  }
  async suspend() {if (this.timer) clearInterval(this.timer); this.timer = null; for (const voice of this.musicVoices) {try {voice.stop();} catch {}} this.musicVoices.clear(); if (this.context?.state === 'running') await this.context.suspend();}
  async resume() {if ((this.music || this.effects) && this.context?.state === 'suspended') {await this.context.resume(); if (this.music) this.setMusic(true);}}
  destroy() {if (this.timer) clearInterval(this.timer); this.timer = null; void this.context?.close(); this.context = null;}
}
