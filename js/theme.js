// Theme management for Sharp — dark, light, or system sync with persistence.
import { loadJSON, saveJSON, KEYS } from './storage.js';

const THEME_KEY = 'theme_preference';
const THEME_COLOR_META = 'meta[name="theme-color"]';

export function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme() {
  const prefs = loadJSON(KEYS.PREFERENCES, {});
  return prefs.theme || 'auto';
}

export function getEffectiveTheme(preference = getStoredTheme()) {
  if (preference === 'auto') {
    return getSystemTheme();
  }
  return preference === 'dark' ? 'dark' : 'light';
}

export function applyTheme(preference) {
  const effective = getEffectiveTheme(preference);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.style.colorScheme = effective;

  const metaThemeColor = document.querySelector(THEME_COLOR_META);
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', effective === 'dark' ? '#141c18' : '#f6f7f4');
  }

  // Update theme toggle UI state if present
  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    const isDark = effective === 'dark';
    toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    toggleBtn.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  window.dispatchEvent(new CustomEvent('sharp:themechange', { detail: { preference, effective } }));
}

export function setTheme(preference) {
  const prefs = loadJSON(KEYS.PREFERENCES, {});
  prefs.theme = preference;
  saveJSON(KEYS.PREFERENCES, prefs);
  applyTheme(preference);
}

export function toggleTheme() {
  const current = getEffectiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);

  // Watch system color scheme changes if set to auto
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredTheme() === 'auto') {
        applyTheme('auto');
      }
    });
  }

}
