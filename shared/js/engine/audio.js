// Sons 100 % synthétisés avec la Web Audio API : aucun fichier audio, aucun droit.
// Un petit synthé (oscillateurs + bruit filtré + enveloppes), une banque d'effets
// prêts à l'emploi et un séquenceur chiptune pour la musique.

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

// 'A4' → 440 Hz ; nombre = numéro MIDI
export function noteFreq(note) {
  if (typeof note === 'number') return 440 * 2 ** ((note - 69) / 12);
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) return 440;
  const midi = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicEnabled = false;
    this.volume = 0.8;
    this.noiseBuffer = null;
    this.song = null;
    this.musicTimer = 0;
    this.lastPlay = new Map();
    this._unlock = this._unlock.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._unlock, { capture: true });
      window.addEventListener('keydown', this._unlock, { capture: true });
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }
  }

  _unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.connect(comp);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.35;
      this.musicBus.connect(this.master);
      this._applyVolume();
      if (this.song && this.musicEnabled) this._startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  configure({ sound, music, volume } = {}) {
    if (sound !== undefined) this.enabled = sound;
    if (volume !== undefined) this.volume = volume;
    if (music !== undefined) {
      const was = this.musicEnabled;
      this.musicEnabled = music;
      if (music && !was && this.song) this._startMusic();
      if (!music && was) this._stopMusic();
    }
    this._applyVolume();
  }

  _applyVolume() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volume, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.enabled ? 1 : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.enabled && this.musicEnabled ? 0.35 : 0, t, 0.05);
  }

  _noise() {
    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  _out(pan, bus) {
    if (!pan || !this.ctx.createStereoPanner) return bus;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(bus);
    return p;
  }

  /** Oscillateur avec enveloppe et glissando. */
  tone({ type = 'square', freq = 440, to, duration = 0.12, attack = 0.004, volume = 0.3, delay = 0, vibrato = 0, vibratoRate = 18, filter, pan = 0, bus } = {}) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = vibratoRate;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + duration + 0.05);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    node.connect(gain).connect(this._out(pan, bus ?? this.sfxBus));
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Bruit blanc filtré (impacts, souffles, explosions, caisse claire). */
  noise({ duration = 0.2, volume = 0.3, freq = 2000, to, q = 0.8, filterType = 'bandpass', delay = 0, attack = 0.002, pan = 0, bus } = {}) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._noise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f).connect(gain).connect(this._out(pan, bus ?? this.sfxBus));
    src.start(t0, Math.random());
    src.stop(t0 + duration + 0.02);
  }

  /** Petite mélodie : notes = [['C5', 1], ['E5', 1], [null, 1], ...] en temps. */
  jingle(notes, { bpm = 480, type = 'square', volume = 0.22, delay = 0 } = {}) {
    const beat = 60 / bpm;
    let t = delay;
    for (const [note, beats = 1] of notes) {
      if (note) this.tone({ type, freq: noteFreq(note), duration: beat * beats * 0.95, volume, delay: t });
      t += beat * beats;
    }
  }

  /**
   * Joue un effet de la banque. `pitch` multiplie les fréquences (×1 = normal),
   * une légère variation aléatoire évite l'effet « mitraillette ».
   */
  play(name, { pitch = 1, volume = 1, pan = 0, vary = 0.04, throttle = 0.03 } = {}) {
    if (!this.ready || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlay.get(name) ?? -1) < throttle) return;
    this.lastPlay.set(name, now);
    const fx = SFX[name];
    if (!fx) return;
    const p = pitch * (1 + (Math.random() * 2 - 1) * vary);
    fx(this, p, volume, pan);
  }

  // ---------- Musique : séquenceur 16 pas ----------
  /**
   * song = { bpm: 120, steps: 16, tracks: [
   *   { type: 'triangle', volume: 0.2, notes: ['C3', null, 'G3', ...], length: 0.9 },
   *   { drum: 'kick' | 'snare' | 'hat', volume: 0.3, pattern: 'x...x...x...x...' } ] }
   */
  setSong(song) {
    this._stopMusic();
    this.song = song;
    if (song && this.musicEnabled && this.ctx) this._startMusic();
  }

  _startMusic() {
    if (!this.ctx || !this.song || this.musicTimer) return;
    const song = this.song;
    const stepDur = 60 / song.bpm / 4;
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (nextTime < this.ctx.currentTime + 0.12) {
        const delay = Math.max(0, nextTime - this.ctx.currentTime);
        for (const tr of song.tracks) {
          if (tr.drum) {
            const pat = tr.pattern;
            if (pat[step % pat.length] === 'x') DRUMS[tr.drum](this, delay, tr.volume ?? 0.3);
          } else {
            const n = tr.notes[step % tr.notes.length];
            if (n) {
              this.tone({
                type: tr.type ?? 'square',
                freq: noteFreq(n),
                duration: stepDur * (tr.length ?? 0.9) * (tr.hold ?? 1),
                volume: tr.volume ?? 0.15,
                delay,
                filter: tr.filter,
                bus: this.musicBus,
              });
            }
          }
        }
        nextTime += stepDur;
        step++;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 25);
  }

  _stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  pauseMusic() {
    this._stopMusic();
  }

  resumeMusic() {
    if (this.musicEnabled) this._startMusic();
  }
}

const DRUMS = {
  kick(a, delay, v) {
    a.tone({ type: 'sine', freq: 150, to: 40, duration: 0.18, volume: v, delay, bus: a.musicBus });
  },
  snare(a, delay, v) {
    a.noise({ duration: 0.12, volume: v * 0.7, freq: 1800, q: 0.6, delay, bus: a.musicBus });
  },
  hat(a, delay, v) {
    a.noise({ duration: 0.04, volume: v * 0.4, freq: 8000, filterType: 'highpass', delay, bus: a.musicBus });
  },
};

// Banque d'effets. Chaque entrée : (audio, pitch, volume, pan)
const SFX = {
  click: (a, p, v, pan) => a.tone({ type: 'square', freq: 900 * p, to: 600 * p, duration: 0.04, volume: 0.12 * v, pan }),
  hover: (a, p, v) => a.tone({ type: 'sine', freq: 1200 * p, duration: 0.03, volume: 0.05 * v }),
  select: (a, p, v) => {
    a.tone({ type: 'square', freq: 660 * p, duration: 0.06, volume: 0.14 * v });
    a.tone({ type: 'square', freq: 990 * p, duration: 0.08, volume: 0.14 * v, delay: 0.05 });
  },
  back: (a, p, v) => a.tone({ type: 'square', freq: 520 * p, to: 300 * p, duration: 0.09, volume: 0.13 * v }),
  confirm: (a, p, v) => a.jingle([['C5', 1], ['G5', 2]], { bpm: 900, volume: 0.16 * v }),
  error: (a, p, v) => {
    a.tone({ type: 'square', freq: 180 * p, duration: 0.1, volume: 0.16 * v });
    a.tone({ type: 'square', freq: 150 * p, duration: 0.16, volume: 0.16 * v, delay: 0.09 });
  },
  jump: (a, p, v, pan) => a.tone({ type: 'square', freq: 280 * p, to: 620 * p, duration: 0.14, volume: 0.16 * v, filter: 3000, pan }),
  doubleJump: (a, p, v, pan) => a.tone({ type: 'square', freq: 420 * p, to: 940 * p, duration: 0.14, volume: 0.15 * v, filter: 3500, pan }),
  flap: (a, p, v, pan) => {
    a.noise({ duration: 0.09, volume: 0.18 * v, freq: 900 * p, to: 2600 * p, q: 1.2, pan });
    a.tone({ type: 'triangle', freq: 380 * p, to: 560 * p, duration: 0.08, volume: 0.1 * v, pan });
  },
  land: (a, p, v, pan) => a.noise({ duration: 0.07, volume: 0.16 * v, freq: 500 * p, to: 200, filterType: 'lowpass', pan }),
  step: (a, p, v, pan) => a.noise({ duration: 0.03, volume: 0.05 * v, freq: 1200 * p, q: 2, pan }),
  whoosh: (a, p, v, pan) => a.noise({ duration: 0.25, volume: 0.14 * v, freq: 400 * p, to: 2400 * p, q: 1.5, attack: 0.08, pan }),
  coin: (a, p, v, pan) => {
    a.tone({ type: 'square', freq: 988 * p, duration: 0.06, volume: 0.13 * v, pan });
    a.tone({ type: 'square', freq: 1319 * p, duration: 0.18, volume: 0.13 * v, delay: 0.055, pan });
  },
  pickup: (a, p, v, pan) => a.tone({ type: 'triangle', freq: 600 * p, to: 1400 * p, duration: 0.12, volume: 0.2 * v, pan }),
  pop: (a, p, v, pan) => {
    a.tone({ type: 'sine', freq: 520 * p, to: 1500 * p, duration: 0.07, volume: 0.25 * v, pan });
    a.noise({ duration: 0.05, volume: 0.1 * v, freq: 3000 * p, q: 1, pan });
  },
  tick: (a, p, v, pan) => a.tone({ type: 'square', freq: 1800 * p, duration: 0.025, volume: 0.08 * v, pan }),
  tock: (a, p, v, pan) => a.tone({ type: 'square', freq: 1100 * p, duration: 0.03, volume: 0.08 * v, pan }),
  place: (a, p, v, pan) => {
    a.tone({ type: 'triangle', freq: 300 * p, to: 180 * p, duration: 0.09, volume: 0.25 * v, pan });
    a.noise({ duration: 0.04, volume: 0.08 * v, freq: 2500, pan });
  },
  hit: (a, p, v, pan) => {
    a.noise({ duration: 0.18, volume: 0.32 * v, freq: 1200 * p, to: 150, q: 0.7, pan });
    a.tone({ type: 'square', freq: 220 * p, to: 60 * p, duration: 0.2, volume: 0.2 * v, pan });
  },
  explode: (a, p, v, pan) => {
    a.noise({ duration: 0.6, volume: 0.4 * v, freq: 900 * p, to: 60, filterType: 'lowpass', q: 0.5, pan });
    a.tone({ type: 'sine', freq: 120 * p, to: 30, duration: 0.5, volume: 0.35 * v, pan });
  },
  powerup: (a, p, v) => a.jingle([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 2]], { bpm: 1100, volume: 0.15 * v, type: 'square' }),
  combo: (a, p, v, pan) => {
    a.tone({ type: 'square', freq: 660 * p, duration: 0.05, volume: 0.12 * v, pan });
    a.tone({ type: 'square', freq: 880 * p, duration: 0.08, volume: 0.12 * v, delay: 0.045, pan });
  },
  perfect: (a, p, v, pan) => {
    a.tone({ type: 'triangle', freq: 1046 * p, duration: 0.1, volume: 0.2 * v, pan });
    a.tone({ type: 'triangle', freq: 1568 * p, duration: 0.22, volume: 0.18 * v, delay: 0.07, vibrato: 12, pan });
  },
  nearMiss: (a, p, v, pan) => a.tone({ type: 'sawtooth', freq: 700 * p, to: 1700 * p, duration: 0.16, volume: 0.09 * v, filter: 2600, pan }),
  win: (a, p, v) => a.jingle([['G4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['G5', 4]], { bpm: 720, volume: 0.17 * v }),
  lose: (a, p, v) => a.jingle([['G4', 2], ['E4', 2], ['C4', 2], ['G3', 5]], { bpm: 520, volume: 0.17 * v, type: 'triangle' }),
  gameOver: (a, p, v) => {
    a.tone({ type: 'square', freq: 392, to: 98, duration: 0.7, volume: 0.16 * v, filter: 1800 });
  },
  record: (a, p, v) => {
    a.jingle([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['G5', 1], ['C6', 4]], { bpm: 840, volume: 0.17 * v });
    a.jingle([['E4', 1], ['G4', 1], ['C5', 1], ['E5', 1], ['C5', 1], ['E5', 4]], { bpm: 840, volume: 0.09 * v, type: 'triangle' });
  },
  levelUp: (a, p, v) => a.jingle([['A4', 1], ['C#5', 1], ['E5', 1], ['A5', 3]], { bpm: 900, volume: 0.16 * v }),
  achievement: (a, p, v) => {
    a.jingle([['E5', 1], ['B5', 3]], { bpm: 700, volume: 0.15 * v, type: 'triangle' });
    a.tone({ type: 'sine', freq: 2637, duration: 0.5, volume: 0.05 * v, delay: 0.1, vibrato: 30 });
  },
  countdown: (a, p, v) => a.tone({ type: 'square', freq: 660 * p, duration: 0.1, volume: 0.15 * v }),
  go: (a, p, v) => a.tone({ type: 'square', freq: 1320 * p, duration: 0.3, volume: 0.15 * v }),
};

export const audio = new AudioEngine();
export const sfxNames = Object.keys(SFX);
