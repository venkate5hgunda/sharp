// Backup & Schema Migration Engine for Sharp — Single-File JSON Export/Import with Checksum
import { loadJSON, saveJSON, getAllSharpData, replaceSharpData, KEYS, CURRENT_SCHEMA_VERSION } from './storage.js';
import { exportHydratedDataset } from '../data/questions-db.js';
import { isRecord, isSafeData, validateQuestion, MAX_IMPORT_BYTES } from './content-validation.js';

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
function validateBackupData(data) {
  const allowed = new Set([...Object.values(KEYS), 'question_stats', 'custom_questions']);
  if (!isRecord(data) || !isSafeData(data) || Object.keys(data).some((key) => !allowed.has(key))) return 'Invalid or unsafe backup records.';
  for (const key of Object.keys(data)) {
    if (key === KEYS.SCHEMA_VERSION) {
      if (data[key] !== CURRENT_SCHEMA_VERSION) return 'Inconsistent stored schema version.';
    } else if ([KEYS.HISTORY, 'custom_questions'].includes(key)) {
      if (!Array.isArray(data[key]) || data[key].length > 5000) return `Invalid ${key} array.`;
    } else if (!isRecord(data[key]) && !(key === KEYS.DELAYED_MEMORY && data[key] === null)) return `Invalid ${key} record.`;
  }
  const ratings = data.ratings || {};
  if (Object.entries(ratings).some(([key, value]) => !['memory', 'math', 'logic', 'comprehension', 'focus'].includes(key) ||
      typeof value !== 'number' || value < 600 || value > 2500)) return 'Invalid ratings.';
  const streaks = data.streaks || {};
  for (const key of ['current', 'longest']) {
    if (streaks[key] !== undefined && (!Number.isInteger(streaks[key]) || streaks[key] < 0)) return 'Invalid streak count.';
  }
  const day = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (streaks.lastWorkoutDate != null && !day(streaks.lastWorkoutDate)) return 'Invalid workout date.';
  if (streaks.history !== undefined && (!isRecord(streaks.history) || Object.entries(streaks.history).some(([key, count]) =>
      !day(key) || !Number.isInteger(count) || count < 0))) return 'Invalid streak history.';
  const sessionIds = new Set();
  for (const round of data.session_history || []) {
    if (!isRecord(round) || typeof round.id !== 'string' || !/^[\w:-]{1,160}$/.test(round.id)) return 'Invalid session history.';
    if (sessionIds.has(round.id)) return 'Duplicate session ID.';
    sessionIds.add(round.id);
    for (const key of ['gameId', 'domain']) {
      if (round[key] !== undefined && (typeof round[key] !== 'string' || !/^[\w-]{1,80}$/.test(round[key]))) return 'Invalid session identity.';
    }
    if (round.date !== undefined && !day(round.date)) return 'Invalid session date.';
    for (const key of ['accuracy', 'averageLatencyMs', 'ratingBefore', 'ratingAfter', 'timestamp', 'questionsCount', 'correctCount', 'tier']) {
      if (round[key] !== undefined && (typeof round[key] !== 'number' || round[key] < 0)) return 'Invalid session metrics.';
    }
    if (round.accuracy > 1 || (round.correctCount !== undefined && round.correctCount > round.questionsCount)) return 'Invalid session accuracy.';
  }
  for (const question of data.custom_questions || []) {
    const result = validateQuestion(question);
    if (!result.valid) return result.error;
  }
  const preferences = data.preferences || {};
  if (preferences.theme !== undefined && !['auto', 'light', 'dark'].includes(preferences.theme)) return 'Invalid theme preference.';
  for (const key of ['sound', 'haptics', 'notifications']) {
    if (preferences[key] !== undefined && typeof preferences[key] !== 'boolean') return 'Invalid preference value.';
  }
  for (const key of ['morningTime', 'eveningTime']) {
    if (preferences[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferences[key])) return 'Invalid reminder time.';
  }
  const meta = data.backup_meta || {};
  if (meta.lastBackupDate !== undefined && !day(meta.lastBackupDate)) return 'Invalid backup date.';
  const memory = data.delayed_memory;
  if (memory != null && (!['committed', 'completed'].includes(memory.status) ||
      !Array.isArray(memory.items) || memory.items.length < 1 || memory.items.length > 100 ||
      memory.items.some((item) => !isRecord(item) || ['word', 'category', 'icon', 'cue'].some((key) => typeof item[key] !== 'string')) ||
      !Number.isFinite(memory.createdAt) || !Number.isFinite(memory.readyAt))) return 'Invalid delayed memory session.';
  for (const stats of Object.values(data.question_stats || {})) {
    if (!isRecord(stats) || ['timesServed', 'correctCount', 'totalLatencyMs', 'averageLatencyMs'].some((key) =>
      stats[key] !== undefined && (typeof stats[key] !== 'number' || stats[key] < 0))) return 'Invalid question statistics.';
  }
  return null;
}

export function validateAndMigrateBackup(rawJson) {
  let parsed;
  try {
    if (typeof rawJson === 'string' && new TextEncoder().encode(rawJson).length > MAX_IMPORT_BYTES) {
      return { valid: false, error: 'Backup exceeds 5 MiB.' };
    }
    parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    if (!isRecord(parsed) || !isSafeData(parsed)) return { valid: false, error: 'Invalid backup structure or unsafe content.' };
    if (new TextEncoder().encode(JSON.stringify(parsed)).length > MAX_IMPORT_BYTES) return { valid: false, error: 'Backup exceeds 5 MiB.' };
  } catch {
    return { valid: false, error: 'File is not valid JSON.' };
  }
  if (parsed.appName !== 'sharp') return { valid: false, error: 'Backup is not a valid Sharp dataset.' };
  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1) return { valid: false, error: 'Missing or corrupt schema version.' };
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) return { valid: false, error: 'This backup schema is not supported by this version of Sharp.' };
  if (typeof parsed.exportedAt !== 'string' || !Number.isFinite(Date.parse(parsed.exportedAt))) return { valid: false, error: 'Invalid export timestamp.' };
  const error = validateBackupData(parsed.data);
  if (error) return { valid: false, error };
  const integrityVerified = Object.hasOwn(parsed, 'checksum');
  if (integrityVerified) {
    const core = { appName: parsed.appName, schemaVersion: parsed.schemaVersion, exportedAt: parsed.exportedAt,
      exportDate: parsed.exportDate, data: parsed.data };
    if (typeof parsed.checksum !== 'string' || computeSimpleChecksum(JSON.stringify(core)) !== parsed.checksum) {
      return { valid: false, error: 'Backup checksum does not match. The file may be damaged or modified.' };
    }
  }
  return {
    valid: true, schemaVersion: parsed.schemaVersion, exportedAt: parsed.exportedAt,
    data: JSON.parse(JSON.stringify(parsed.data)), integrityVerified,
    warnings: integrityVerified ? [] : ['Legacy backup has no checksum. Its integrity cannot be verified.'],
    summary: { hasRatings: !!parsed.data.ratings, sessionCount: parsed.data.session_history?.length || 0, streak: parsed.data.streaks?.current || 0 }
  };
}

export function applyBackup(data, mode = 'replace') {
  const error = validateBackupData(data);
  if (error) return { success: false, error };
  if (!['replace', 'merge'].includes(mode)) return { success: false, error: 'Invalid restore mode.' };
  let next = JSON.parse(JSON.stringify(data));
  if (mode === 'merge') {
    let current;
    try { current = getAllSharpData(); } catch {
      return { success: false, error: 'Could not read existing progress. Browser storage recovery must finish before merging.' };
    }
    if (validateBackupData(current)) return { success: false, error: 'Existing progress cannot be merged safely. Export it before choosing a replacement restore.' };
    const history = new Map((current.session_history || []).map((round) => [round.id, round]));
    for (const round of data.session_history || []) if (!history.has(round.id)) history.set(round.id, round);
    // Preserve legacy merge semantics until rating projections move to IndexedDB.
    const ratings = { ...(current.ratings || {}) };
    for (const [domain, rating] of Object.entries(data.ratings || {})) ratings[domain] = Math.max(ratings[domain] || 1000, rating);
    const a = current.streaks || {};
    const b = data.streaks || {};
    const questions = new Map((current.custom_questions || []).map((question) => [question.id, question]));
    for (const question of data.custom_questions || []) if (!questions.has(question.id)) questions.set(question.id, question);
    next = { ...data, ...current, ratings, session_history: [...history.values()], custom_questions: [...questions.values()],
      streaks: { current: Math.max(a.current || 0, b.current || 0), longest: Math.max(a.longest || 0, b.longest || 0),
        lastWorkoutDate: a.lastWorkoutDate || b.lastWorkoutDate || null, history: { ...(b.history || {}), ...(a.history || {}) } } };
  }
  next.schema_version = CURRENT_SCHEMA_VERSION;
  next.backup_meta = { ...(next.backup_meta || {}), lastBackupDate: new Date().toISOString().slice(0, 10), lastBackupTimestamp: Date.now() };
  const nextError = validateBackupData(next);
  if (nextError) return { success: false, error: nextError };
  return replaceSharpData(next);
}
