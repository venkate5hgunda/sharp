// Settings View — Audio, Haptics, Theme, Schedules & Preferences
import { loadJSON, saveJSON, clearAllSharpData, KEYS } from '../storage.js';
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { setTheme, getStoredTheme } from '../theme.js';
import { notifications } from '../notifications.js';

export function render(container) {
  const prefs = loadJSON(KEYS.PREFERENCES, {});
  const currentTheme = getStoredTheme();
  const notifState = notifications.getPermissionState();

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Settings &amp; Preferences</h1>
        <p class="view-desc">Configure sound, haptics, theme, and daily notification schedules.</p>
      </div>
    </div>

    <div class="settings-card">
      <h3 class="settings-group-title">Sensory &amp; Interface</h3>

      <div class="setting-row">
        <div>
          <strong>Sound Effects</strong>
          <small class="text-muted">Synthesized Web Audio clicks, chimes, and cues</small>
        </div>
        <label class="switch">
          <input type="checkbox" id="soundToggleInput" ${prefs.sound !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-row">
        <div>
          <strong>Haptic Feedback</strong>
          <small class="text-muted">Vibration feedback on mobile touch gestures</small>
        </div>
        <label class="switch">
          <input type="checkbox" id="hapticsToggleInput" ${prefs.haptics !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-row">
        <div>
          <strong>Theme Preference</strong>
          <small class="text-muted">Light, dark, or automatic system match</small>
        </div>
        <div class="theme-select-group" id="themeGroup">
          <button class="btn btn-sm ${currentTheme === 'auto' ? 'btn-primary' : 'btn-outline'}" data-theme-val="auto" type="button">Auto</button>
          <button class="btn btn-sm ${currentTheme === 'light' ? 'btn-primary' : 'btn-outline'}" data-theme-val="light" type="button">Light</button>
          <button class="btn btn-sm ${currentTheme === 'dark' ? 'btn-primary' : 'btn-outline'}" data-theme-val="dark" type="button">Dark</button>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3 class="settings-group-title">Notifications &amp; Daily Schedule</h3>
      
      <div class="setting-row">
        <div>
          <strong>Web Notifications</strong>
          <small class="text-muted">Permission status: <strong>${notifState}</strong></small>
        </div>
        <div>
          ${notifState !== 'granted' ? `
            <button id="requestNotifBtn" class="btn btn-sm btn-primary" type="button">
              Enable Notifications
            </button>
          ` : `
            <span class="text-green font-semibold">✓ Enabled</span>
          `}
        </div>
      </div>

      <div class="setting-row">
        <div>
          <strong>Morning Memory Drop Time</strong>
          <small class="text-muted">Notification when daily items are ready to commit</small>
        </div>
        <input type="time" id="morningTime" class="time-input" value="${prefs.morningTime || '08:30'}">
      </div>

      <div class="setting-row">
        <div>
          <strong>Evening Recall Test Time</strong>
          <small class="text-muted">Reminder to test your retention before bed</small>
        </div>
        <input type="time" id="eveningTime" class="time-input" value="${prefs.eveningTime || '19:30'}">
      </div>
    </div>

    <div class="settings-card is-danger-zone">
      <h3 class="settings-group-title text-amber">Data Reset</h3>
      <div class="setting-row">
        <div>
          <strong>Reset All Local Progress</strong>
          <small class="text-muted">Clears all ratings, history, and streaks from this browser.</small>
        </div>
        <button id="clearDataBtn" class="btn btn-sm btn-danger" type="button">
          Reset Data
        </button>
      </div>
    </div>
  `;

  // Bind Sound Toggle
  container.querySelector('#soundToggleInput').addEventListener('change', (e) => {
    audio.setEnabled(e.target.checked);
    if (e.target.checked) audio.chime();
  });

  // Bind Haptics Toggle
  container.querySelector('#hapticsToggleInput').addEventListener('change', (e) => {
    haptics.setEnabled(e.target.checked);
    if (e.target.checked) haptics.success();
  });

  // Bind Theme Selection
  container.querySelectorAll('#themeGroup button').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.tap();
      const val = btn.dataset.themeVal;
      setTheme(val);
      render(container);
    });
  });

  // Bind Notification Request
  container.querySelector('#requestNotifBtn')?.addEventListener('click', async () => {
    audio.tap();
    const result = await notifications.requestPermission();
    if (result === 'granted') {
      audio.chime();
      notifications.notify({
        title: 'Sharp Notifications Active!',
        body: 'You will receive reminders for morning drops and evening recall sessions.'
      });
    }
    render(container);
  });

  // Bind Times
  container.querySelector('#morningTime').addEventListener('change', (e) => {
    const p = loadJSON(KEYS.PREFERENCES, {});
    p.morningTime = e.target.value;
    saveJSON(KEYS.PREFERENCES, p);
    audio.tap();
  });

  container.querySelector('#eveningTime').addEventListener('change', (e) => {
    const p = loadJSON(KEYS.PREFERENCES, {});
    p.eveningTime = e.target.value;
    saveJSON(KEYS.PREFERENCES, p);
    audio.tap();
  });

  // Bind Clear Data
  container.querySelector('#clearDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to completely reset all cognitive training statistics? This cannot be undone unless you have a backup.')) {
      clearAllSharpData();
      audio.buzz();
      location.reload();
    }
  });
}
