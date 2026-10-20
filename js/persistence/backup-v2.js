import { digest, migrateLegacy, emptyState } from './repository.js';
import { validateAndMigrateBackup } from '../backup.js';
import { isRecord, isSafeData } from '../content-validation.js';
import { validateItem, importedItems } from '../session/content.js';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const domains = ['memory', 'math', 'logic', 'comprehension', 'focus'];
const safeId = (id) => typeof id === 'string' && /^[\w.:-]{1,200}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
const finite = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const day = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
export function validateState(state) {
  if (!isRecord(state) || state.version !== 2 || !Number.isInteger(state.revision) || state.revision < 0 ||
    Object.keys(state).some((k) => ![...Object.keys(emptyState()), 'memoryExposure', 'memoryHistory', 'resultCache'].includes(k))) return 'Unsupported or malformed data schema.';
  // Original migration bytes are inert recovery data and may contain quarantined HTML. Never render them.
  const safe = structuredClone(state); if (safe.migration) delete safe.migration.raw;
  if (!isSafeData(safe)) return 'Unsafe data or excessive nesting.';
  if (state.migration?.raw && (!isRecord(state.migration.raw) || Object.entries(state.migration.raw).some(([k, v]) => !k.startsWith('sharp:') || typeof v !== 'string' || v.length > 5 * 1024 * 1024))) return 'Invalid migration archive.';
  for (const key of ['sessions', 'attempts', 'rounds', 'workouts', 'preferences', 'legacy', 'ratingsBaseline']) if (!isRecord(state[key])) return `Invalid ${key}.`;
  if (Object.entries(state.ratingsBaseline).some(([d, n]) => !domains.includes(d) || !finite(n, 600, 2500))) return 'Invalid rating baseline.';
  if (!Array.isArray(state.content) || importedItems(state.content).length !== state.content.length) return 'Invalid content pack.';
  for (const [id, s] of Object.entries(state.sessions)) {
    if (!safeId(id) || s.id !== id || !['active', 'completed', 'abandoned'].includes(s.status) || !Array.isArray(s.rounds) || !s.rounds.length || s.rounds.length > 10 ||
      !Number.isInteger(s.roundIndex) || s.roundIndex < 0 || s.roundIndex >= s.rounds.length || !finite(s.createdAt) || !finite(s.updatedAt)) return 'Invalid session checkpoint.';
    for (const r of s.rounds) {
      if (!domains.includes(r.domain) || !['intro', 'question', 'feedback', 'summary'].includes(r.phase) ||
        !Array.isArray(r.items) || !r.items.length || r.items.length > 100 || !Number.isInteger(r.position) || r.position < 0 || r.position > r.items.length || !Array.isArray(r.attempts)) return 'Invalid round checkpoint.';
      for (const item of r.items) {
        if (['pattern-flash', 'corsi-span'].includes(r.game)) {
          if (!safeId(item.id) || !Number.isInteger(item.size) || item.size < 4 || item.size > 25 || !Array.isArray(item.sequence) || !item.sequence.length || item.sequence.length > 20 || item.sequence.some((v) => !Number.isInteger(v) || v < 0 || v >= item.size)) return 'Invalid visual stimulus.';
        } else if (!validateItem(item)) return 'Invalid stored question.';
      }
      if (r.attempts.some((a) => !state.attempts[a])) return 'Checkpoint references missing attempts.';
    }
  }
  for (const [id, a] of Object.entries(state.attempts)) {
    if (!safeId(id) || a.id !== id || !state.sessions[a.sessionId] || !domains.includes(a.domain) || !finite(a.score, 0, 1) ||
      !['binary-v1', 'pattern-f1-v1'].includes(a.scoring) || !finite(a.activeMs) || !finite(a.hiddenMs) || !finite(a.readingMs) || !finite(a.timestamp) || !day(a.date)) return 'Invalid attempt evidence.';
  }
  for (const [id, r] of Object.entries(state.rounds)) if (!safeId(id) || r.id !== id || !state.sessions[r.sessionId] || !domains.includes(r.domain) || !Number.isInteger(r.count) || r.count < 1 || !finite(r.score, 0, r.count) || !finite(r.latencyMs) || !finite(r.expectedMs, 1) || !Number.isInteger(r.tier) || r.tier < 1 || r.tier > 7 || !finite(r.timestamp) || !day(r.date)) return 'Invalid committed round.';
  for (const [id, w] of Object.entries(state.workouts)) if (!safeId(id) || !state.sessions[id] || !day(w.date) || !finite(w.timestamp) || w.completedAt !== null && !finite(w.completedAt)) return 'Invalid workout.';
  if (state.memory && (!isRecord(state.memory) || !safeId(state.memory.id) || !['committed', 'completed'].includes(state.memory.status) || !Array.isArray(state.memory.items) || !state.memory.items.length || state.memory.items.length > 100 || state.memory.items.some((i) => typeof i.word !== 'string') || !finite(state.memory.readyAt) || !finite(state.memory.createdAt))) return 'Invalid memory snapshot.';
  for (const [k, cap] of [['diagnostics', 500], ['traces', 100], ['outbox', 200]]) if (!Array.isArray(state[k]) || state[k].length > cap) return `Invalid ${k} buffer.`;
  if (state.preferences.theme !== undefined && !['auto', 'dark', 'light'].includes(state.preferences.theme)) return 'Invalid theme.';
  for (const k of ['sound', 'haptics', 'notifications', 'onboarded', 'sharing', 'sharePayloads', 'shareErrors']) if (state.preferences[k] !== undefined && typeof state.preferences[k] !== 'boolean') return 'Invalid preference.';
  for (const k of ['morningTime', 'eveningTime']) if (state.preferences[k] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.preferences[k])) return 'Invalid reminder time.';
  return null;
}
export async function exportBackup(repo) {
  const data = await repo.refresh();
  const core = { appName: 'sharp', schemaVersion: 2, exportedAt: new Date().toISOString(), data };
  return { ...core, sha256: await digest(core) };
}
export async function readBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 20 MiB.');
  let payload; try { payload = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  if (!isRecord(payload)) throw new Error('Unsupported backup schema.');
  if (payload.schemaVersion === 1) {
    const result = validateAndMigrateBackup(payload); if (!result.valid) throw new Error(result.error);
    const entries = Object.entries(result.data).map(([k, v]) => [`sharp:${k}`, JSON.stringify(v)]);
    const data = await migrateLegacy({ length: entries.length, key: (i) => entries[i][0], getItem: (k) => entries.find(([key]) => key === k)[1] });
    return { data, warnings: ['Migrated v1: historical rounds retain their summary granularity and legacy calendar labels.', ...result.warnings] };
  }
  if (payload.appName !== 'sharp' || payload.schemaVersion !== 2 || typeof payload.exportedAt !== 'string' || !Number.isFinite(Date.parse(payload.exportedAt))) throw new Error('Unsupported backup schema.');
  const { sha256, ...core } = payload;
  if (typeof sha256 !== 'string' || await digest(core) !== sha256) throw new Error('Backup checksum does not match.');
  const error = validateState(payload.data); if (error) throw new Error(error);
  return { data: payload.data, warnings: [] };
}
export function mergePreview(current, incoming) {
  const conflicts = [];
  for (const key of ['sessions', 'attempts', 'rounds', 'workouts']) for (const [id, item] of Object.entries(incoming[key])) {
    if (current[key][id] && JSON.stringify(current[key][id]) !== JSON.stringify(item)) conflicts.push(`${key}: ${id}`);
  }
  for (const key of ['memory', 'ratingsBaseline', 'legacy']) if (current[key] && incoming[key] && JSON.stringify(current[key]) !== JSON.stringify(incoming[key])) conflicts.push(key);
  return conflicts;
}
export async function restoreBackup(repo, incoming, { mode = 'replace', conflicts = 'current' } = {}) {
  const error = validateState(incoming); if (error) throw new Error(error);
  if (!['replace', 'merge'].includes(mode) || !['current', 'incoming'].includes(conflicts)) throw new Error('Invalid restore choice.');
  return repo.update((current) => {
    let next = structuredClone(incoming);
    if (mode === 'merge') {
      const preferred = conflicts === 'incoming' ? incoming : current, other = conflicts === 'incoming' ? current : incoming;
      next = { ...structuredClone(other), ...structuredClone(preferred) };
      for (const key of ['sessions', 'attempts', 'rounds', 'workouts']) next[key] = { ...other[key], ...preferred[key] };
      const content = new Map(other.content.map((q) => [q.id, q])); preferred.content.forEach((q) => content.set(q.id, q)); next.content = [...content.values()];
    }
    // Invalidate every old tab's write ownership; restored sessions must be claimed again.
    for (const s of Object.values(next.sessions)) { s.owner = null; s.leaseUntil = 0; }
    next.outbox = []; next.preferences.sharing = false; next.preferences.sharePayloads = false;
    const invalid = validateState(next); if (invalid) throw new Error(invalid);
    return next; // Ratings/streaks are projections of evidence, never maxima from two devices.
  });
}
export function downloadJSON(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
