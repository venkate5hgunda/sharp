import { enableBrowserAlerts, showBrowserReminder, subscribePush, pushAvailable, disableAlerts } from '../push.js';
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
    <p><label><input id="hapticsPreference" type="checkbox" ${p.haptics !== false ? 'checked' : ''}> Haptics</label></p>
    <label for="themePreference">Theme</label><select id="themePreference">${['auto', 'light', 'dark'].map((t) => `<option value="${t}" ${t === (p.theme || 'auto') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="settings-card"><h2>Reminders</h2><p>In-app reminders work while Sharp is open. Use your calendar for alerts.</p>
    <p><button id="enableAlerts" class="btn btn-outline">Enable playful browser alerts</button> <button id="previewAlert" class="btn btn-outline">Preview Pip’s reminder</button> <button id="disableAlerts" class="btn btn-outline">Turn browser alerts off</button></p><p id="alertStatus" role="status">Browser alerts: ${p.browserAlerts ? 'enabled' : 'off'}. Scheduled alerts require Sharp to be open. Calendar reminders work when it is closed.</p><button id="subscribePush" class="btn btn-outline" ${pushAvailable() ? '' : 'disabled'}>Enable background push</button><p>${pushAvailable() ? 'Subscribe to scheduled reminders from the configured push service.' : 'Background push service is not configured on this static installation.'}</p>
    <p><label><input id="foregroundReminders" type="checkbox" ${p.foregroundReminders ? 'checked' : ''}> In-app reminders</label></p>
    <p><label for="morningTime">Study time</label><input id="morningTime" type="time" value="${h(p.morningTime || '08:30')}"></p>
    <p><label for="eveningTime">Recall time</label><input id="eveningTime" type="time" value="${h(p.eveningTime || '19:30')}"></p>
    <button id="calendarExport" class="btn btn-primary">Download calendar reminders</button></div>
    <div class="settings-card"><h2>Storage</h2><p>Progress stays here. Works offline after setup. Keep a backup.</p>
    <button id="persistStorage" class="btn btn-outline">Protect local storage</button><p id="storageStatus"></p><a class="btn btn-outline" href="#/backup">Backup &amp; content</a></div>
    <div class="settings-card"><h2>AI &amp; privacy</h2><p>On-device AI: ${FEATURES.browserInference ? 'on' : 'off'}. </p>
    <p>Developer sharing: ${FEATURES.remoteDeveloperTelemetry ? 'on' : 'off'}. </p>
    <a class="btn btn-outline" href="#/diagnostics">Developer tools</a></div>
    <div class="settings-card"><h2>Reset progress</h2><p>Deletes this device’s progress. Back up first.</p><button id="resetProgress" class="btn btn-danger">Reset this browser</button></div>`;
  const status = container.querySelector('#settingsStatus');
  const alertStatus = container.querySelector('#alertStatus');
  for (const [id, action, message] of [
    ['enableAlerts', () => enableBrowserAlerts(repo), 'Browser alerts enabled. Sharp must be open for scheduled checks.'],
    ['previewAlert', async () => { if (!await showBrowserReminder(repo.snapshot().preferences, { text: 'A tiny brain adventure is ready. Bring your curiosity; Pip will bring the sparkles.', route: 'today' }, { preview: true })) throw new Error('Enable browser alerts first and wait for offline setup to finish.'); }, 'Preview sent.'],
    ['subscribePush', () => subscribePush(repo), 'Background push subscribed.'],
    ['disableAlerts', () => disableAlerts(repo), 'Browser alerts and background push are off.']
  ]) scope.listen(container.querySelector('#' + id), 'click', async () => { try { await action(); if (scope.active) alertStatus.textContent = message; } catch (e) { if (scope.active) alertStatus.textContent = e.message; } });
  const run = async (action) => { try { await action(); if (scope.active) status.textContent = 'Saved.'; } catch (e) { if (scope.active) status.textContent = e.message; } };
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
    status.textContent = 'Import the file into your calendar to enable alerts.';
  });
  scope.listen(container.querySelector('#persistStorage'), 'click', () => run(async () => {
    const result = await navigator.storage?.persist?.();
    if (scope.active) container.querySelector('#storageStatus').textContent = result === true ? 'Storage protected. Keep backups too.' : result === false ? 'Storage protection declined. Keep backups.' : 'Storage protection unavailable.';
  }));
  scope.listen(container.querySelector('#resetProgress'), 'click', () => run(async () => {
    if (!await confirmAction({ title: 'Reset local progress?', message: 'Delete all local progress? You’ll need a backup to restore it.', confirm: 'Reset progress', danger: true })) return;
    await repo.update(() => emptyState());
    const keys = []; for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith('sharp:')) keys.push(localStorage.key(i));
    keys.forEach((k) => localStorage.removeItem(k)); location.hash = '#/today'; location.reload();
  }));
  return scope.dispose;
}
