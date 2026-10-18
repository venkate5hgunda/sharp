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

function getStorage() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      // Test read/write
      const testKey = '__sharp_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
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
