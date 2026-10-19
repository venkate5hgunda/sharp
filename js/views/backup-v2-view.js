import { createSessionScope } from '../core/session-scope.js';
import { confirmAction } from '../core/dialog.js';
import { escapeHTML as h } from '../content-validation.js';
import { exportBackup, readBackup, mergePreview, restoreBackup, downloadJSON, MAX_BACKUP_BYTES } from '../persistence/backup-v2.js';
import { BASE_CONTENT, importedItems, validateItem } from '../session/content.js';
import { localDayKey } from '../core/calendar.js';

export function renderBackup(container, repo) {
  const scope = createSessionScope();
  container.innerHTML = `<h1 class="view-title">Backup &amp; content</h1><p>Export local progress, active sessions and memory snapshots. A checksum detects file corruption; it does not authenticate a file's author.</p>
    <p id="backupStatus" role="status"></p><div class="backup-card"><h2>Export progress</h2><p>Keep a copy outside this browser. Device storage may be cleared or evicted.</p><button id="exportProgress" class="btn btn-primary">Download backup v2</button>
    <button id="exportContent" class="btn btn-outline">Export curriculum</button></div>
    <div class="backup-card"><h2>Restore or merge</h2><label for="backupFile">Choose a Sharp JSON backup (v1 or v2, up to 20 MiB)</label><input id="backupFile" type="file" accept=".json,application/json"><div id="restorePreview"></div></div>
    <div class="backup-card"><h2>Import a question pack</h2><p>Imported questions are plain text and unrated. Built-in IDs cannot be overridden. The complete pack must validate before it is saved.</p><label for="contentFile">Question pack (v1 or v2, up to 5 MiB)</label><input id="contentFile" type="file" accept=".json,application/json"></div>`;
  const status = container.querySelector('#backupStatus');
  const run = async (action) => { try { await action(); } catch (e) { if (scope.active) status.textContent = e.message; } };
  scope.listen(container.querySelector('#exportProgress'), 'click', () => run(async () => {
    downloadJSON(await exportBackup(repo), `sharp-backup-${localDayKey()}.json`); status.textContent = 'Backup download requested. Keep the downloaded file in a safe place.';
  }));
  scope.listen(container.querySelector('#exportContent'), 'click', () => downloadJSON({ schemaVersion: 2, questions: [...BASE_CONTENT, ...importedItems(repo.snapshot().content)] }, 'sharp-curriculum-v2.json'));
  scope.listen(container.querySelector('#backupFile'), 'change', (event) => run(async () => {
    const file = event.target.files[0]; if (!file) return; if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 20 MiB.');
    const incoming = await readBackup(await file.text()); if (!scope.active) return;
    await repo.refresh(); const conflicts = mergePreview(repo.snapshot(), incoming.data);
    const preview = container.querySelector('#restorePreview');
    preview.innerHTML = `<h3>Backup preview</h3><p>${Object.keys(incoming.data.attempts).length} responses, ${Object.keys(incoming.data.sessions).length} sessions, ${Object.keys(incoming.data.workouts).length} workout records.</p>
      ${incoming.warnings.map((w) => `<p>${h(w)}</p>`).join('')}<p>${conflicts.length} conflicting records. Ratings and local streaks are rebuilt from the selected evidence.</p>
      ${conflicts.length ? `<details><summary>View conflicts</summary><ul>${conflicts.slice(0, 100).map((c) => `<li>${h(c)}</li>`).join('')}</ul></details>` : ''}
      <label for="conflictChoice">When records conflict</label><select id="conflictChoice"><option value="current">Keep current device's records</option><option value="incoming">Use backup's records</option></select>
      <p>Merge preserves your chosen baseline and legacy archive. Replacement removes existing progress. Restoring disables remote sharing and releases session ownership.</p>
      <button id="mergeProgress" class="btn btn-secondary">Merge backup</button><button id="replaceProgress" class="btn btn-danger">Replace progress</button>`;
    for (const [selector, mode] of [['#mergeProgress', 'merge'], ['#replaceProgress', 'replace']]) scope.listen(preview.querySelector(selector), 'click', () => run(async () => {
      if (!await confirmAction({ title: mode === 'merge' ? 'Merge backup?' : 'Replace local progress?', message: mode === 'merge' ? 'Combine records using the conflict choice shown in the preview.' : 'All current progress will be replaced by this backup. Export a current backup first if you need it.', confirm: mode === 'merge' ? 'Merge' : 'Replace', danger: mode === 'replace' })) return;
      await restoreBackup(repo, incoming.data, { mode, conflicts: preview.querySelector('#conflictChoice').value });
      if (scope.active) { preview.innerHTML = ''; status.textContent = 'Restore committed successfully. Active sessions can be resumed from Today.'; }
    }));
  }));
  scope.listen(container.querySelector('#contentFile'), 'change', (event) => run(async () => {
    const file = event.target.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) throw new Error('Question pack exceeds 5 MiB.');
    const parsed = JSON.parse(await file.text()), raw = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(raw) || !raw.length || raw.length > 5000) throw new Error('Expected 1–5000 questions.');
    const items = importedItems(raw);
    if (items.length !== raw.length || new Set(items.map((q) => q.id)).size !== items.length) throw new Error('Invalid or duplicate item, or reserved built-in ID. No items were saved.');
    await repo.update((s) => { const map = new Map(s.content.map((q) => [q.id, q])); items.forEach((q) => map.set(q.id, q)); s.content = [...map.values()]; return s; });
    if (scope.active) status.textContent = `${items.length} unrated questions imported.`;
  }));
  return scope.dispose;
}
