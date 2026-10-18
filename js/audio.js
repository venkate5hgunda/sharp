// Sharp Audio Engine — Pure Web Audio synthesis without external assets.
import { loadJSON, saveJSON, KEYS } from './storage.js';

export class SharpAudio {
  constructor() {
    const prefs = loadJSON(KEYS.PREFERENCES, {});
    this.enabled = prefs.sound !== false;
    this.context = null;
    this.master = null;
    this.playbackSession = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    const prefs = loadJSON(KEYS.PREFERENCES, {});
    prefs.sound = enabled;
    saveJSON(KEYS.PREFERENCES, prefs);
    if (this.master) {
      this.master.gain.value = enabled ? 0.45 : 0;
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  async prepare() {
    if (!this.enabled) return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;

    // Chrome on iOS audio session handling
    if (typeof navigator !== 'undefined' && /CriOS/.test(navigator.userAgent) &&
        /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.audioSession) {
      try {
        if (navigator.audioSession.type !== 'playback') {
          navigator.audioSession.type = 'playback';
          this.playbackSession = true;
        }
      } catch (e) {
        console.warn('Audio session setup error:', e);
      }
    }

    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.45 : 0;
        this.master.connect(this.context.destination);
      }

      if (this.context.state !== 'running') {
        await this.context.resume();
      }
      return this.context.state === 'running';
    } catch (e) {
      console.warn('Could not start Web Audio context:', e);
      return false;
    }
  }

  scheduleTone(freq, duration = 0.08, type = 'sine', volume = 0.4, delay = 0) {
    if (!this.enabled) return;
    if (this.context?.state !== 'running') void this.prepare();
    if (!this.context || this.context.state === 'closed' || !this.master) return;

    try {
      const now = this.context.currentTime + delay;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    } catch (err) {
      console.warn('Error scheduling tone:', err);
    }
  }

  tap() {
    this.scheduleTone(540, 0.04, 'sine', 0.15);
  }

  pop() {
    this.scheduleTone(280, 0.05, 'sine', 0.15);
  }

  chime() {
    // Joyful major triad
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.scheduleTone(f, 0.22, 'triangle', 0.2, idx * 0.05);
    });
  }

  buzz() {
    // Low, non-punitive gentle double-buzz
    this.scheduleTone(140, 0.12, 'sawtooth', 0.18, 0);
    this.scheduleTone(110, 0.14, 'sawtooth', 0.18, 0.08);
  }

  tick() {
    this.scheduleTone(880, 0.02, 'square', 0.06);
  }

  flash() {
    // Ethereal sweep for memory pattern reveal
    [440, 554.37, 659.25].forEach((f, i) => {
      this.scheduleTone(f, 0.35, 'sine', 0.15, i * 0.08);
    });
  }

  distract() {
    // Swift subtle whoosh / static burst for interference phase
    if (!this.enabled || !this.context) return;
    try {
      const now = this.context.currentTime;
      const noise = this.context.createBufferSource();
      const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.15), this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
      noise.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(filter).connect(gain).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.16);
    } catch { /* ignore */ }
  }

  fanfare() {
    // Completion triumphant fanfare
    const notes = [
      { f: 523.25, d: 0.1, t: 0 },
      { f: 659.25, d: 0.1, t: 0.1 },
      { f: 783.99, d: 0.12, t: 0.2 },
      { f: 1046.5, d: 0.35, t: 0.32 }
    ];
    notes.forEach((n) => {
      this.scheduleTone(n.f, n.d, 'triangle', 0.25, n.t);
    });
  }

  streak() {
    // Streak fanfare
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, i) => {
      this.scheduleTone(f, 0.18, 'sine', 0.22, i * 0.06);
    });
  }
}

export const audio = new SharpAudio();
