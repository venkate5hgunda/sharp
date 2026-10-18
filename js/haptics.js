// Haptics engine for Sharp — gentle physical vibration feedback for mobile devices.
import { loadJSON, saveJSON, KEYS } from './storage.js';

class SharpHaptics {
  constructor() {
    const prefs = loadJSON(KEYS.PREFERENCES, {});
    this.enabled = prefs.haptics !== false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    const prefs = loadJSON(KEYS.PREFERENCES, {});
    prefs.haptics = enabled;
    saveJSON(KEYS.PREFERENCES, prefs);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  vibrate(pattern) {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch { /* ignore */ }
  }

  tap() {
    this.vibrate(8);
  }

  success() {
    this.vibrate([10, 30, 20]);
  }

  warning() {
    this.vibrate([25, 40, 25]);
  }

  celebrate() {
    this.vibrate([15, 40, 20, 40, 45]);
  }
}

export const haptics = new SharpHaptics();
