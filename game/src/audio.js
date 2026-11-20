// Sound: every effect is synthesized with WebAudio — no audio files,
// no network. Engine hum, two-tone police siren, gunshots, radio bleeps,
// collision thuds and pickup chimes.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioTimer = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine: a low sawtooth through a low-pass filter, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: a triangle wave that wails between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setEngine(speedKmh, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.045 + Math.min(0.05, speedKmh / 4000) : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speedKmh * 1.1, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(280 + speedKmh * 6, t, 0.1);
  }

  setSiren(on, near) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? (near ? 0.05 : 0.022) : 0.0, t, 0.2);
    if (on) {
      // Wail: alternate 660 Hz / 920 Hz every 0.45 s.
      const phase = Math.floor(t / 0.45) % 2;
      this.sirenOsc.frequency.setTargetAtTime(phase === 0 ? 660 : 920, t, 0.05);
    }
  }

  _noiseBurst(dur, filterFreq, gain, type = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  _tone(freq, dur, gain, type = 'square', slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  gunshot(kind) {
    if (kind === 'shotgun') { this._noiseBurst(0.22, 900, 0.5, 'lowpass'); this._tone(90, 0.18, 0.25, 'sine', 40); }
    else if (kind === 'rifle') { this._noiseBurst(0.14, 1600, 0.4); this._tone(140, 0.1, 0.2, 'sine', 60); }
    else if (kind === 'smg') { this._noiseBurst(0.08, 2200, 0.3); }
    else { this._noiseBurst(0.1, 1800, 0.35); } // pistol
  }

  thud(strength = 1) {
    this._noiseBurst(0.18, 220, 0.35 * strength, 'lowpass');
    this._tone(70, 0.16, 0.3 * strength, 'sine', 35);
  }

  pickup() { this._tone(660, 0.09, 0.2, 'sine'); this._tone(990, 0.14, 0.2, 'sine'); }
  click() { this._tone(1200, 0.04, 0.12, 'square'); }
  denied() { this._tone(180, 0.16, 0.2, 'square', 120); }
  mission() { this._tone(523, 0.12, 0.22, 'sine'); this._tone(659, 0.12, 0.22, 'sine'); this._tone(784, 0.22, 0.22, 'sine'); }
  busted() { this._tone(392, 0.25, 0.25, 'sawtooth', 196); this._tone(311, 0.4, 0.25, 'sawtooth', 155); }
  radioBlip() { this._tone(880, 0.05, 0.1, 'square'); this._tone(1174, 0.07, 0.1, 'square'); }

  // A little "radio music": a looping bassline + hats, synthesized, so the
  // car radio has something to play without any audio file.
  radioTick(dt, on) {
    if (!this.ctx || !on) return;
    this.radioTimer -= dt;
    if (this.radioTimer > 0) return;
    this.radioTimer = 0.22;
    const notes = [110, 0, 130.8, 0, 98, 0, 146.8, 123.5];
    const i = Math.floor(this.ctx.currentTime / 0.22) % notes.length;
    const n = notes[i];
    if (n) this._tone(n, 0.2, 0.05, 'triangle');
    if (i % 2 === 0) this._noiseBurst(0.03, 6000, 0.03, 'highpass');
  }
}
