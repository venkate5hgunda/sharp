import {
  enableBrowserAlerts,
  showBrowserReminder,
  subscribePush,
  pushAvailable,
  disableAlerts,
  syncPushState,
} from '../push.js';
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
  const scope = createSessionScope(),
    p = repo.snapshot().preferences;
  container.innerHTML = /* HTML */ `
    <div class="view-header"><h1 class="view-title">Settings</h1></div>
    <p id="settingsStatus" role="status"></p>
    <div class="settings-card">
      <h2>Appearance &amp; sound</h2>
      <div class="preference-row">
        <label for="themePreference">Theme</label>
        <select id="themePreference">
          ${[
            ['auto', 'System'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}" ${value === (p.theme || 'auto') ? 'selected' : ''}>${label}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="preference-row">
        <label for="soundPreference">Sound effects</label>
        <input id="soundPreference" type="checkbox" ${p.sound !== false ? 'checked' : ''} />
      </div>
      <div class="preference-row">
        <label for="hapticsPreference">Vibration</label>
        <input id="hapticsPreference" type="checkbox" ${p.haptics !== false ? 'checked' : ''} />
      </div>
    </div>
    <details class="settings-card">
      <summary>Reminders</summary>
      <p>Choose when to study and recall.</p>
      <div class="preference-row">
        <label for="morningTime">Study time</label>
        <input id="morningTime" type="time" value="${h(p.morningTime || '08:30')}" />
      </div>
      <div class="preference-row">
        <label for="eveningTime">Recall time</label>
        <input id="eveningTime" type="time" value="${h(p.eveningTime || '19:30')}" />
      </div>
      <p>Calendar reminders work even when Sharp is closed.</p>
      <button id="calendarExport" class="btn btn-primary">Download calendar reminders</button>
      <div class="preference-row">
        <label for="foregroundReminders">Remind me while Sharp is open</label>
        <input id="foregroundReminders" type="checkbox" ${p.foregroundReminders ? 'checked' : ''} />
      </div>
      <p id="alertStatus" role="status">
        Browser alerts are ${p.browserAlerts ? 'on' : 'off'}. Sharp needs to be open.
      </p>
      <button id="enableAlerts" class="btn btn-outline">Enable browser alerts</button>
      <button id="previewAlert" class="btn btn-outline">Preview reminder</button>
      <button id="disableAlerts" class="btn btn-outline">Turn alerts off</button>
    </details>
    <div class="settings-card">
      <h2>Your data</h2>
      <p>Your progress stays on this device.</p>
      <a class="btn btn-primary" href="#/backup">Back up or restore</a>
      <button id="persistStorage" class="btn btn-outline">Protect saved progress</button>
      <p id="storageStatus" role="status"></p>
    </div>
    <details class="settings-card">
      <summary>Advanced</summary>
      <h2>Background alerts</h2>
      <div class="preference-row">
        <label for="pushTime">Daily reminder time</label>
        <input
          id="pushTime"
          type="time"
          min="08:00"
          max="20:59"
          value="${h(p.pushTime || '08:30')}"
        />
      </div>
      <p>
        ${pushAvailable()
          ? 'At most one reminder a day, between 08:00 and 21:00. Works when Sharp is closed.'
          : 'Unavailable on this version of Sharp. Use calendar reminders instead.'}
      </p>
      <p>
        The reminder service stores your subscription, timezone, reminder time, completion date and
        recall time. Answers and scores stay on this device.
      </p>
      <button id="subscribePush" class="btn btn-outline" ${pushAvailable() ? '' : 'disabled'}>
        Enable background push
      </button>
      <h2>Privacy</h2>
      <p>
        On-device AI: ${FEATURES.browserInference ? 'on' : 'off'}. Developer sharing:
        ${FEATURES.remoteDeveloperTelemetry ? 'on' : 'off'}.
      </p>
      <a class="btn btn-outline" href="#/diagnostics">Developer tools</a>
      <h2>Reset progress</h2>
      <p>Deletes progress on this device. Back up first.</p>
      <button id="resetProgress" class="btn btn-danger">Reset this browser</button>
    </details>
  `;
  const status = container.querySelector('#settingsStatus');
  const alertStatus = container.querySelector('#alertStatus');
  for (const [id, action, message] of [
    [
      'enableAlerts',
      () => enableBrowserAlerts(repo),
      'Browser alerts enabled. Sharp must be open for scheduled checks.',
    ],
    [
      'previewAlert',
      async () => {
        if (
          !(await showBrowserReminder(
            repo.snapshot().preferences,
            {
              text: 'A tiny brain adventure is ready. Bring your curiosity; Pip will bring the sparkles.',
              route: 'today',
            },
            { preview: true }
          ))
        )
          throw new Error('Enable browser alerts first and wait for offline setup to finish.');
      },
      'Preview sent.',
    ],
    ['subscribePush', () => subscribePush(repo), 'Background push subscribed.'],
    ['disableAlerts', () => disableAlerts(repo), 'Browser alerts and background push are off.'],
  ])
    scope.listen(container.querySelector('#' + id), 'click', async () => {
      try {
        await action();
        if (scope.active) alertStatus.textContent = message;
      } catch (e) {
        if (scope.active) alertStatus.textContent = e.message;
      }
    });
  const run = async (action) => {
    try {
      await action();
      if (scope.active) status.textContent = 'Saved.';
    } catch (e) {
      if (scope.active) status.textContent = e.message;
    }
  };
  for (const [id, key] of [
    ['soundPreference', 'sound'],
    ['hapticsPreference', 'haptics'],
    ['foregroundReminders', 'foregroundReminders'],
    ['pushTime', 'pushTime'],
    ['morningTime', 'morningTime'],
    ['eveningTime', 'eveningTime'],
    ['themePreference', 'theme'],
  ]) {
    scope.listen(container.querySelector(`#${id}`), 'change', (event) =>
      run(async () => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        await repo.setPreferences({ [key]: value });
        if (key === 'pushTime') await syncPushState(repo);
        if (key === 'sound') audio.setEnabled(value);
        if (key === 'haptics') haptics.setEnabled(value);
        if (key === 'theme') setTheme(value);
      })
    );
  }
  scope.listen(container.querySelector('#calendarExport'), 'click', () => {
    const url = URL.createObjectURL(
      new Blob([reminderCalendar(repo.snapshot().preferences)], { type: 'text/calendar' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sharp-daily-reminders.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Import the file into your calendar to enable alerts.';
  });
  scope.listen(container.querySelector('#persistStorage'), 'click', () =>
    run(async () => {
      const result = await navigator.storage?.persist?.();
      if (scope.active)
        container.querySelector('#storageStatus').textContent =
          result === true
            ? 'Storage protected. Keep backups too.'
            : result === false
              ? 'Storage protection declined. Keep backups.'
              : 'Storage protection unavailable.';
    })
  );
  scope.listen(container.querySelector('#resetProgress'), 'click', () =>
    run(async () => {
      if (
        !(await confirmAction({
          title: 'Reset local progress?',
          message: 'Delete all local progress? You’ll need a backup to restore it.',
          confirm: 'Reset progress',
          danger: true,
        }))
      )
        return;
      if (repo.snapshot().preferences.pushManagementToken) await disableAlerts(repo);
      await repo.update(() => emptyState());
      const keys = [];
      for (let i = 0; i < localStorage.length; i++)
        if (localStorage.key(i)?.startsWith('sharp:')) keys.push(localStorage.key(i));
      keys.forEach((k) => localStorage.removeItem(k));
      location.hash = '#/today';
      location.reload();
    })
  );
  return scope.dispose;
}
