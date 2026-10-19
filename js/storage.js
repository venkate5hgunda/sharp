// Storage layer for Sharp — Namespaced localStorage with quota tolerance & schema versioning.

const PREFIX = 'sharp:';
export const CURRENT_SCHEMA_VERSION = 1;

export const KEYS = {
  SCHEMA_VERSION: 'schema_version',
  PROFILE: 'profile',
  RATINGS: 'ratings',
  STREAKS: 'streaks',
  DAILY_WORKOUT: 'daily_workout',
  DELAYED_MEMORY: 'delayed_memory',
  HISTORY: 'session_history',
  PREFERENCES: 'preferences',
  BACKUP_META: 'backup_meta'
};

const memoryStore = new Map();
const RESTORE_JOURNAL = PREFIX + '__restore_journal';

function rawStorage() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage;
    }
  } catch {}

  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    get length() { return memoryStore.size; },
    key: (i) => Array.from(memoryStore.keys())[i] || null
  };
}

function rawSnapshot(store) {
  const snapshot = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(PREFIX) && key !== RESTORE_JOURNAL) snapshot[key] = store.getItem(key);
  }
  return snapshot;
}

function recoverRestore(store) {
  const journal = store.getItem(RESTORE_JOURNAL);
  if (journal === null) return;
  const previous = JSON.parse(journal);
  if (!previous || Array.isArray(previous) || typeof previous !== 'object' ||
      Object.entries(previous).some(([key, value]) => !key.startsWith(PREFIX) || key === RESTORE_JOURNAL || typeof value !== 'string')) {
    throw new Error('Invalid restore recovery record.');
  }
  for (const key of Object.keys(rawSnapshot(store))) {
    if (!Object.hasOwn(previous, key)) store.removeItem(key);
  }
  for (const [key, value] of Object.entries(previous)) store.setItem(key, value);
  store.removeItem(RESTORE_JOURNAL);
}

function getStorage() {
  const store = rawStorage();
  recoverRestore(store);
  return store;
}

// localStorage has no transactions. Keep a durable rollback journal until every write succeeds.
export function replaceSharpData(data) {
  let store;
  let journalWritten = false;
  try {
    const serialized = Object.entries(data).map(([key, value]) => {
      if (key === '__restore_journal' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid storage key.');
      const json = JSON.stringify(value);
      if (json === undefined) throw new Error('Invalid storage value.');
      return [PREFIX + key, json];
    });
    store = getStorage();
    const previous = rawSnapshot(store);
    store.setItem(RESTORE_JOURNAL, JSON.stringify(previous));
    journalWritten = true;
    for (const [key, value] of serialized) store.setItem(key, value);
    const incoming = new Set(serialized.map(([key]) => key));
    for (const key of Object.keys(previous)) if (!incoming.has(key)) store.removeItem(key);
    store.removeItem(RESTORE_JOURNAL);
    return { success: true };
  } catch {
    if (journalWritten) {
      try { recoverRestore(store); } catch {
        return { success: false, error: 'Restore failed. Recovery is pending until browser storage is writable again.' };
      }
    }
    return { success: false, error: 'Could not restore backup. Existing progress was preserved; free browser storage and retry.' };
  }
}

export function loadJSON(key, fallback = null) {
  try {
    const raw = getStorage().getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    getStorage().setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    getStorage().removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

export function getAllSharpData() {
  const store = getStorage();
  const data = {};
  for (let i = 0; i < store.length; i++) {
    const fullKey = store.key(i);
    if (fullKey && fullKey.startsWith(PREFIX)) {
      const subKey = fullKey.slice(PREFIX.length);
      try {
        data[subKey] = JSON.parse(store.getItem(fullKey));
      } catch {
        data[subKey] = store.getItem(fullKey);
      }
    }
  }
  return data;
}

export function clearAllSharpData() {
  const store = getStorage();
  const keysToRemove = [];
  for (let i = 0; i < store.length; i++) {
    const fullKey = store.key(i);
    if (fullKey && fullKey.startsWith(PREFIX)) {
      keysToRemove.push(fullKey);
    }
  }
  keysToRemove.forEach((key) => store.removeItem(key));
}

export function getStorageStats() {
  const store = getStorage();
  let totalBytes = 0;
  let count = 0;
  for (let i = 0; i < store.length; i++) {
    const fullKey = store.key(i);
    if (fullKey && fullKey.startsWith(PREFIX)) {
      count++;
      const val = store.getItem(fullKey) || '';
      totalBytes += (fullKey.length + val.length) * 2;
    }
  }
  return {
    itemCount: count,
    approxBytes: totalBytes,
    kb: (totalBytes / 1024).toFixed(1)
  };
}
