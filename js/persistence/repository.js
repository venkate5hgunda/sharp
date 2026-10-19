// One transactional aggregate keeps attempts, projections and checkpoints consistent.
// No successful UI acknowledgement occurs before IDBTransaction.complete.
import { isRecord, isSafeData } from '../content-validation.js';
import { validateAndMigrateBackup } from '../backup.js';

export const DATA_VERSION = 2;
export const DB_NAME = 'sharp-progress-v2';
const clone = (value) => structuredClone(value);
export function emptyState() {
  return { version: DATA_VERSION, revision: 0, preferences: {}, sessions: {}, attempts: {}, rounds: {},
    workouts: {}, memory: null, content: [], diagnostics: [], traces: [], outbox: [],
    ratingsBaseline: { memory: 1000, math: 1000, logic: 1000, comprehension: 1000, focus: 1000 },
    legacy: {}, migration: null };
}

export async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function migrateLegacy(store) {
  const state = emptyState();
  const raw = {};
  if (store) for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith('sharp:')) raw[key] = store.getItem(key);
  }
  const quarantine = [];
  for (const [key, text] of Object.entries(raw)) {
    const name = key.slice(6);
    try {
      const value = JSON.parse(text);
      const check = validateAndMigrateBackup({ appName: 'sharp', schemaVersion: 1, exportedAt: new Date().toISOString(), data: { [name]: value } });
      if (!check.valid) throw new Error(check.error);
      state.legacy[name] = value;
    } catch { quarantine.push(key); }
  }
  state.preferences = clone(state.legacy.preferences || {});
  state.ratingsBaseline = { ...state.ratingsBaseline, ...state.legacy.ratings };
  state.content = clone(state.legacy.custom_questions || []);
  // The complete study snapshot survives content pack changes and migration retries.
  if (state.legacy.delayed_memory?.status === 'committed') state.memory = { ...clone(state.legacy.delayed_memory), migrated: true };
  state.migration = { version: 1, completedAt: Date.now(), digest: await digest(raw), raw, quarantine,
    calendarPolicy: state.legacy.streaks ? 'utc-legacy' : 'local-v1' };
  return state;
}

export class Repository {
  constructor({ factory = globalThis.indexedDB, name = DB_NAME, legacyStorage, onStatus = () => {} } = {}) {
    this.factory = factory; this.name = name; this.legacyStorage = legacyStorage; this.onStatus = onStatus;
    this.db = null; this.cached = null; this.listeners = new Set();
  }
  async open() {
    if (!this.factory) throw new Error('Browser storage is unavailable. Enable IndexedDB, then retry.');
    const candidate = await migrateLegacy(this.legacyStorage);
    this.db = await new Promise((resolve, reject) => {
      const request = this.factory.open(this.name, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('state'); };
      request.onblocked = () => this.onStatus('Close older Sharp tabs to finish updating storage.');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    this.db.onversionchange = () => { this.close(); this.onStatus('Storage was updated in another tab. Reload Sharp to continue.'); };
    await this.update((state) => state || candidate, { initialize: true });
    return this;
  }
  snapshot() { if (!this.cached) throw new Error('Storage is not ready.'); return clone(this.cached); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async refresh() {
    const state = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('state', 'readonly');
      const req = tx.objectStore('state').get('current');
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || new Error('Storage read failed.'));
    });
    this.cached = state;
    return this.snapshot();
  }
  async update(mutator, { initialize = false } = {}) {
    if (!this.db) throw new Error('Storage is closed. Reload Sharp to continue.');
    const state = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const req = store.get('current');
      let next, error;
      req.onsuccess = () => {
        try {
          const current = req.result;
          next = mutator(current && clone(current));
          if (next?.then) throw new Error('Repository mutations must be synchronous.');
          if (!isRecord(next) || next.version !== DATA_VERSION) throw new Error('Invalid storage state.');
          next.revision = (current?.revision || 0) + (initialize && current ? 0 : 1);
          store.put(next, 'current');
        } catch (cause) { error = cause; tx.abort(); }
      };
      tx.oncomplete = () => resolve(next);
      tx.onabort = () => reject(error || tx.error || new Error('Could not save. Free browser storage and retry.'));
      tx.onerror = () => {}; // onabort is the single error boundary.
    });
    // A slower completion must never regress a newer in-memory snapshot.
    if (!this.cached || state.revision >= this.cached.revision) this.cached = state;
    this.listeners.forEach((fn) => fn(this.snapshot()));
    return this.snapshot();
  }
  async setPreferences(patch) {
    if (!isSafeData(patch)) throw new Error('Invalid preferences.');
    return this.update((state) => { Object.assign(state.preferences, patch); return state; });
  }
  close() { this.db?.close(); this.db = null; }
}

export let repository;
export async function initRepository(options = {}) {
  let legacyStorage;
  try { legacyStorage = globalThis.localStorage; } catch {}
  repository = new Repository({ legacyStorage, ...options });
  return repository.open();
}
