// Backup & Schema Migration Engine for Sharp — Single-File JSON Export/Import with Checksum
import { loadJSON, saveJSON, getAllSharpData, clearAllSharpData, KEYS, CURRENT_SCHEMA_VERSION } from './storage.js';
import { exportHydratedDataset } from '../data/questions-db.js';

export function computeSimpleChecksum(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function downloadQuestionDatasetFile() {
  const payload = exportHydratedDataset();
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sharp-questions-hydrated-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return payload;
}

export function generateBackupPayload() {
  const allData = getAllSharpData();
  const exportTimestamp = Date.now();
  const exportDate = new Date().toISOString().slice(0, 10);

  const payloadCore = {
    appName: 'sharp',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date(exportTimestamp).toISOString(),
    exportDate,
    data: allData
  };

  const serialized = JSON.stringify(payloadCore);
  const checksum = computeSimpleChecksum(serialized);

  return {
    ...payloadCore,
    checksum
  };
}

export function downloadBackupFile() {
  const payload = generateBackupPayload();
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sharp-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Mark backup completed today
  markBackupCompleted();
  return payload;
}

export function markBackupCompleted() {
  const meta = loadJSON(KEYS.BACKUP_META, {});
  meta.lastBackupDate = new Date().toISOString().slice(0, 10);
  meta.lastBackupTimestamp = Date.now();
  saveJSON(KEYS.BACKUP_META, meta);
}

export function shouldRemindBackup() {
  const meta = loadJSON(KEYS.BACKUP_META, {});
  const today = new Date().toISOString().slice(0, 10);
  return meta.lastBackupDate !== today;
}

/**
 * Validates and migrates an uploaded backup payload.
 */
export function validateAndMigrateBackup(rawJson) {
  let parsed;
  try {
    parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    return { valid: false, error: 'File is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid backup structure.' };
  }

  if (parsed.appName !== 'sharp') {
    return { valid: false, error: 'Backup is not a valid Sharp dataset.' };
  }

  if (!parsed.schemaVersion || typeof parsed.schemaVersion !== 'number') {
    return { valid: false, error: 'Missing or corrupt schema version.' };
  }

  // Schema Migrations (e.g. if older versions exist in future)
  let migratedData = parsed.data || {};
  let currentVer = parsed.schemaVersion;

  if (currentVer < CURRENT_SCHEMA_VERSION) {
    // Run version migrations sequentially if needed
    // e.g. if (currentVer === 1) { migratedData = migrateV1ToV2(migratedData); currentVer = 2; }
  }

  // Verify checksum if present
  if (parsed.checksum) {
    const checkCore = {
      appName: parsed.appName,
      schemaVersion: parsed.schemaVersion,
      exportedAt: parsed.exportedAt,
      exportDate: parsed.exportDate,
      data: parsed.data
    };
    const expectedChecksum = computeSimpleChecksum(JSON.stringify(checkCore));
    if (expectedChecksum !== parsed.checksum) {
      console.warn('Checksum mismatch in backup file, but data appears parseable.');
    }
  }

  return {
    valid: true,
    schemaVersion: currentVer,
    exportedAt: parsed.exportedAt,
    data: migratedData,
    summary: {
      hasRatings: !!migratedData.ratings,
      sessionCount: Array.isArray(migratedData.session_history) ? migratedData.session_history.length : 0,
      streak: migratedData.streaks?.current || 0
    }
  };
}

/**
 * Applies imported backup data to localStorage.
 * @param {object} data Validated and migrated data dictionary
 * @param {string} mode 'replace' | 'merge'
 */
export function applyBackup(data, mode = 'replace') {
  if (mode === 'replace') {
    clearAllSharpData();
    Object.entries(data).forEach(([key, val]) => {
      saveJSON(key, val);
    });
  } else if (mode === 'merge') {
    // Merge history and preserve highest streak/ratings
    const currentHistory = loadJSON(KEYS.HISTORY, []);
    const importedHistory = data.session_history || [];
    const mergedHistory = [...currentHistory];
    const existingIds = new Set(currentHistory.map((h) => h.id));

    importedHistory.forEach((h) => {
      if (!existingIds.has(h.id)) mergedHistory.push(h);
    });
    saveJSON(KEYS.HISTORY, mergedHistory);

    // Merge streaks
    const currentStreaks = loadJSON(KEYS.STREAKS, { current: 0, longest: 0, history: {} });
    const importedStreaks = data.streaks || { current: 0, longest: 0, history: {} };
    saveJSON(KEYS.STREAKS, {
      current: Math.max(currentStreaks.current, importedStreaks.current),
      longest: Math.max(currentStreaks.longest, importedStreaks.longest),
      lastWorkoutDate: currentStreaks.lastWorkoutDate || importedStreaks.lastWorkoutDate,
      history: { ...(importedStreaks.history || {}), ...(currentStreaks.history || {}) }
    });

    // Merge ratings by taking average or highest
    const currentRatings = loadJSON(KEYS.RATINGS, {});
    const importedRatings = data.ratings || {};
    const mergedRatings = { ...currentRatings };
    Object.keys(importedRatings).forEach((k) => {
      mergedRatings[k] = Math.max(currentRatings[k] || 1000, importedRatings[k] || 1000);
    });
    saveJSON(KEYS.RATINGS, mergedRatings);

    // Preferences: keep current
  }

  saveJSON(KEYS.SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
  markBackupCompleted();
  return true;
}
