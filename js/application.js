import { mountCoach } from './coach.js';
import { showBrowserReminder, syncPushState } from './push.js';
import { initRepository } from './persistence/repository.js';
import { SessionController } from './session/controller.js';
import { renderSession } from './views/session-view.js';
import { renderMemory } from './views/memory-view.js';
import { renderProgress } from './views/progress-view.js';
import { renderSettings } from './views/settings-view.js';
import { renderBackup } from './views/backup-view.js';
import { CATALOG } from './content/catalog.js';
import { SharpRouter } from './router.js';
import { renderToday } from './views/today-view.js';
import { renderCatalog } from './views/catalog-view.js';
import { renderExercise } from './views/exercise-view.js';
import { dueReminder } from './core/reminders.js';
import { escapeHTML as h } from './content-validation.js';
import { initTheme, setTheme } from './theme.js';
import { audio } from './audio.js';
import { haptics } from './haptics.js';
import { createId } from './core/identity.js';
import { DiagnosticsBroker } from './diagnostics/broker.js';
import { FEATURES } from './core/feature-flags.js';
import { TELEMETRY_CONFIG } from './diagnostics/config.js';
export async function boot() {
  const container = document.querySelector('#appContainer'),
    banner = document.querySelector('#inAppBannerHost');
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    container.focus({ preventScroll: true });
  });
  const showStatus = (message) => {
    banner.textContent = message;
    banner.setAttribute('role', 'status');
  };
  initTheme();
  container.innerHTML = '<h1>Opening your local progress…</h1>';
  let repo;
  try {
    repo = await initRepository({ onStatus: showStatus });
  } catch (error) {
    container.innerHTML =
      '<h1>Storage needs attention</h1><p id="bootError"></p><p>Progress has not been reset. Enable browser storage or close older Sharp tabs, then retry.</p><button id="retryBoot" class="btn btn-primary">Retry</button><button id="exportLegacy" class="btn btn-outline">Download legacy recovery data</button>';
    container.querySelector('#bootError').textContent = error.message;
    container.querySelector('#retryBoot').onclick = () => location.reload();
    container.querySelector('#exportLegacy').onclick = async () => {
      const { downloadJSON } = await import('./persistence/backup-v2.js');
      const raw = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sharp:')) raw[key] = localStorage.getItem(key);
      }
      downloadJSON({ recovery: true, raw }, 'sharp-legacy-recovery.json');
    };
    return;
  }
  let previousOwner = null;
  const owner = createId('page');
  try {
    previousOwner = sessionStorage.getItem('sharp:page-owner');
    sessionStorage.setItem('sharp:page-owner', owner);
  } catch {}
  const controller = new SessionController(repo, { owner, previousOwner }),
    preferences = repo.snapshot().preferences;
  let transport = null;
  if (FEATURES.remoteDeveloperTelemetry && TELEMETRY_CONFIG.publicProjectKey) {
    try {
      const { PostHogTransport } = await import('./diagnostics/transport.js');
      transport = new PostHogTransport(TELEMETRY_CONFIG);
    } catch {
      showStatus('Developer sharing is unavailable. Training remains local.');
    }
  }
  const diagnostics = new DiagnosticsBroker(repo, { transport });
  if (transport) {
    const flush = () => {
      if (!document.hidden) diagnostics.flush().catch(() => {});
    };
    setInterval(flush, 60000);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', flush);
  }
  window.addEventListener('error', () => diagnostics.record('app.error', { code: 'unknown' }));
  window.addEventListener('unhandledrejection', () =>
    diagnostics.record('app.error', { code: 'unknown' })
  );
  if (preferences.theme) setTheme(preferences.theme);
  audio.enabled = preferences.sound !== false;
  haptics.enabled = preferences.haptics !== false;
  const unlock = () => {
    audio.prepare();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  let freshSession = null;
  const run = async (action) => {
    try {
      await action();
    } catch (error) {
      showStatus(error.message);
      diagnostics.record('app.warning', {
        code: error.name === 'QuotaExceededError' ? 'quota' : 'other',
      });
    }
  };
  const navigate = (path) => router.navigateTo(path);
  const openSession = (id) => {
    freshSession = id;
    navigate(`session/${id}`);
  };
  const router = new SharpRouter(container, {
    beforeRoute: () => repo.refresh(),
    onError: (error) =>
      run(() => {
        throw error;
      }),
    onRoute: () =>
      syncPushState(repo).catch(() =>
        showStatus('Push reminder sync is pending. Reopen Settings when online.')
      ),
    resolve: async ({ path, param }) => {
      if (path === 'today')
        return () => renderToday(container, { repo, controller, navigate, run });
      if (path === 'exercises') return () => renderCatalog(container);
      if (path === 'progress') return () => renderProgress(container, repo);
      if (path === 'backup') return () => renderBackup(container, repo);
      if (path === 'settings') return () => renderSettings(container, repo);
      if (path === 'session' && param)
        return () => {
          const cleanup = renderSession(container, {
            repo,
            controller,
            id: param,
            navigate,
            freshStart: freshSession === param,
          });
          freshSession = null;
          return cleanup;
        };
      if (path === 'games' && param === 'delayed-memory')
        return () => renderMemory(container, { repo, controller, navigate });
      if (path === 'games' && CATALOG.some((game) => game.id === param))
        return () => renderExercise(container, { repo, controller, game: param, openSession, run });
      if (path === 'model') {
        const { renderModel } = await import('./views/model-view.js');
        return () => renderModel(container, repo);
      }
      if (path === 'diagnostics') {
        const { renderDiagnostics } = await import('./views/diagnostics-view.js');
        return () => renderDiagnostics(container, repo, diagnostics);
      }
      return null;
    },
  });
  window.addEventListener('pagehide', () => router.dispose());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) run(checkReminder);
  });
  async function checkReminder() {
    if (document.hidden) return;
    await repo.refresh();
    const due = dueReminder(repo.snapshot());
    if (!due) return;
    await showBrowserReminder(repo.snapshot().preferences, due).catch(() => false);
    await repo.setPreferences({ lastReminder: due.id });
    banner.innerHTML = `<p>${h(due.text)} <a href="#/${due.route}">Open memory practice</a> <button type="button" id="dismissReminder" class="btn btn-outline">Dismiss</button></p>`;
    banner.querySelector('#dismissReminder').onclick = () => {
      banner.textContent = '';
    };
  }
  setInterval(() => run(checkReminder), 60000);
  if ('serviceWorker' in navigator)
    navigator.serviceWorker
      .register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then((registration) => {
        if (!navigator.serviceWorker.controller)
          navigator.serviceWorker.ready.then(() => {
            document.body.dataset.offlineReady = 'true';
          });
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              showStatus('Update ready. Close all Sharp tabs, then reopen.');
          });
        });
      })
      .catch(() => showStatus('Offline setup failed. Reopen while online to retry.'));
  mountCoach(repo);
  await router.init();
  await checkReminder();
}
