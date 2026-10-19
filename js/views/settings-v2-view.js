import { createSessionScope } from '../core/session-scope.js';
import { confirmAction } from '../core/dialog.js';
import { reminderCalendar } from '../core/reminders.js';
import { emptyState } from '../persistence/repository.js';
import { escapeHTML as h } from '../content-validation.js';
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { setTheme } from '../theme.js';
import { FEATURES } from '../core/feature-flags.js';
export function renderSettings(container, repo) {
  const scope = createSessionScope(), p = repo.snapshot().preferences;
  container.innerHTML = `<h1 class="view-title">Settings</h1><p id="settingsStatus" role="status"></p>
    <div class="settings-card"><h2>Interface</h2>
    <p><label><input id="soundPreference" type="checkbox" ${p.sound !== false ? 'checked' : ''}> Sound effects</label></p>
    <p><label><input id="hapticsPreference" type="checkbox" ${p.haptics !== false ? 'checked' : ''}> Haptic feedback when supported</label></p>
    <label for="themePreference">Theme</label><select id="themePreference">${['auto', 'light', 'dark'].map((t) => `<option value="${t}" ${t === (p.theme || 'auto') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="settings-card"><h2>Reminders</h2><p>Reminders appear while Sharp is open and visible. A closed or suspended app cannot schedule reliable alerts. Import a calendar file for reminders managed by your calendar app.</p>
    <p><label><input id="foregroundReminders" type="checkbox" ${p.foregroundReminders ? 'checked' : ''}> Show foreground reminders</label></p>
    <p><label for="morningTime">Study time</label><input id="morningTime" type="time" value="${h(p.morningTime || '08:30')}"></p>
    <p><label for="eveningTime">Recall reminder time</label><input id="eveningTime" type="time" value="${h(p.eveningTime || '19:30')}"></p>
    <button id="calendarExport" class="btn btn-primary">Download daily calendar reminders</button></div>
    <div class="settings-card"><h2>Storage &amp; offline use</h2><p>Progress lives in IndexedDB on this browser. Backups remain necessary even with persistent storage. Offline training is available after the app finishes installing its cache.</p>
    <button id="persistStorage" class="btn btn-outline">Request persistent storage</button><p id="storageStatus"></p><a class="btn btn-outline" href="#/backup">Backup &amp; content</a></div>
    <div class="settings-card"><h2>Optional intelligence &amp; sharing</h2><p>Browser inference: ${FEATURES.browserInference ? 'deployment enabled' : 'disabled in this release'}. No model is downloaded on startup.</p>
    <p>Developer uploads: ${FEATURES.remoteDeveloperTelemetry ? 'deployment enabled' : 'disabled in this release'}. Player progress stays local. Prompt payload sharing has a separate disabled deployment flag.</p>
    <a class="btn btn-outline" href="#/diagnostics">Local diagnostics &amp; evaluation</a></div>
    <div class="settings-card"><h2>Reset progress</h2><p>Export a backup before resetting. This removes progress, imported content and local diagnostics from IndexedDB and the legacy Sharp namespace.</p><button id="resetProgress" class="btn btn-danger">Reset this browser</button></div>`;
  const status = container.querySelector('#settingsStatus');
  const run = async (action) => { try { await action(); if (scope.active) status.textContent = 'Saved on this device.'; } catch (e) { if (scope.active) status.textContent = e.message; } };
  for (const [id, key] of [['soundPreference', 'sound'], ['hapticsPreference', 'haptics'], ['foregroundReminders', 'foregroundReminders'], ['morningTime', 'morningTime'], ['eveningTime', 'eveningTime'], ['themePreference', 'theme']]) {
    scope.listen(container.querySelector(`#${id}`), 'change', (event) => run(async () => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      await repo.setPreferences({ [key]: value });
      if (key === 'sound') audio.setEnabled(value); if (key === 'haptics') haptics.setEnabled(value); if (key === 'theme') setTheme(value);
    }));
  }
  scope.listen(container.querySelector('#calendarExport'), 'click', () => {
    const url = URL.createObjectURL(new Blob([reminderCalendar(repo.snapshot().preferences)], { type: 'text/calendar' }));
    const link = document.createElement('a'); link.href = url; link.download = 'sharp-daily-reminders.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Calendar download requested. Import it into your calendar and check its alert settings.';
  });
  scope.listen(container.querySelector('#persistStorage'), 'click', () => run(async () => {
    const result = await navigator.storage?.persist?.();
    if (scope.active) container.querySelector('#storageStatus').textContent = result === true ? 'Persistent storage granted. Keep backups too.' : result === false ? 'Persistent storage was not granted. Training still works; keep backups.' : 'Persistent storage requests are unavailable in this browser.';
  }));
  scope.listen(container.querySelector('#resetProgress'), 'click', () => run(async () => {
    if (!await confirmAction({ title: 'Reset local progress?', message: 'This removes all training evidence on this browser. It can be recovered only from a backup you already exported.', confirm: 'Reset progress', danger: true })) return;
    await repo.update(() => emptyState());
    const keys = []; for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith('sharp:')) keys.push(localStorage.key(i));
    keys.forEach((k) => localStorage.removeItem(k)); location.hash = '#/today'; location.reload();
  }));
  return scope.dispose;
}
