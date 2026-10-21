import { weeklyJourney } from './core/engagement.js';
import { exerciseIcon, exerciseGuide, skillLabel } from './ui.js';
import { mountCoach } from './coach.js';
import { showBrowserReminder, syncPushState } from './push.js';
import { initRepository } from './persistence/repository.js';
import { SessionController } from './session/controller.js';
import { progressMetrics } from './session/metrics.js';
import { renderSession } from './views/session-view.js';
import { renderMemory } from './views/memory-view.js';
import { renderProgress } from './views/progress-v2-view.js';
import { renderSettings } from './views/settings-v2-view.js';
import { renderBackup } from './views/backup-v2-view.js';
import { CATALOG } from './games/catalog.js';
import { createSessionScope } from './core/session-scope.js';
import { localDayKey } from './core/calendar.js';
import { dueReminder } from './core/reminders.js';
import { escapeHTML as h } from './content-validation.js';
import { initTheme, setTheme } from './theme.js';
import { audio } from './audio.js';
import { haptics } from './haptics.js';
import { createId } from './core/identity.js';
import { BASE_CONTENT, importedItems } from './session/content.js';
import { domainFor } from './session/controller.js';
import { DiagnosticsBroker } from './diagnostics/broker.js';
import { FEATURES } from './core/feature-flags.js';
import { TELEMETRY_CONFIG } from './diagnostics/config.js';
export async function boot() {
  const container = document.querySelector('#appContainer'), banner = document.querySelector('#inAppBannerHost');
  const showStatus = (message) => { banner.textContent = message; banner.setAttribute('role', 'status'); };
  initTheme(); container.innerHTML = '<h1>Opening your local progress…</h1>';
  let repo;
  try { repo = await initRepository({ onStatus: showStatus }); }
  catch (error) {
    container.innerHTML = '<h1>Storage needs attention</h1><p id="bootError"></p><p>Progress has not been reset. Enable browser storage or close older Sharp tabs, then retry.</p><button id="retryBoot" class="btn btn-primary">Retry</button><button id="exportLegacy" class="btn btn-outline">Download legacy recovery data</button>';
    container.querySelector('#bootError').textContent = error.message;
    container.querySelector('#retryBoot').onclick = () => location.reload();
    container.querySelector('#exportLegacy').onclick = async () => {
      const { downloadJSON } = await import('./persistence/backup-v2.js'); const raw = {};
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith('sharp:')) raw[key] = localStorage.getItem(key); }
      downloadJSON({ recovery: true, raw }, 'sharp-legacy-recovery.json');
    }; return;
  }
  let previousOwner = null; const owner = createId('page');
  try { previousOwner = sessionStorage.getItem('sharp:page-owner'); sessionStorage.setItem('sharp:page-owner', owner); } catch {}
  const controller = new SessionController(repo, { owner, previousOwner }), preferences = repo.snapshot().preferences;
  let transport = null;
  if (FEATURES.remoteDeveloperTelemetry && TELEMETRY_CONFIG.publicProjectKey) {
    try { const { PostHogTransport } = await import('./diagnostics/transport.js'); transport = new PostHogTransport(TELEMETRY_CONFIG); }
    catch { showStatus('Developer sharing is unavailable. Training remains local.'); }
  }
  const diagnostics = new DiagnosticsBroker(repo, { transport });
  if (transport) {
    const flush = () => { if (!document.hidden) diagnostics.flush().catch(() => {}); };
    setInterval(flush, 60000); window.addEventListener('online', flush); document.addEventListener('visibilitychange', flush);
  }
  window.addEventListener('error', () => diagnostics.record('app.error', { code: 'unknown' }));
  window.addEventListener('unhandledrejection', () => diagnostics.record('app.error', { code: 'unknown' }));
  if (preferences.theme) setTheme(preferences.theme);
  audio.enabled = preferences.sound !== false; haptics.enabled = preferences.haptics !== false;
  const unlock = () => { audio.prepare(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
  let cleanup = () => {}, routeVersion = 0, freshSession = null;
  const navigate = (path) => { location.hash = `#/${path}`; };
  const run = async (action) => { try { await action(); } catch (e) { showStatus(e.message); diagnostics.record('app.warning', { code: e.name === 'QuotaExceededError' ? 'quota' : 'other' }); } };
  async function route() {
    const version = ++routeVersion; cleanup(); cleanup = () => {};
    await repo.refresh(); if (version !== routeVersion) return;
    const [raw = 'today', param] = location.hash.replace(/^#\/?/, '').split('/');
    const aliases = { workout: 'today', catalog: 'exercises', analytics: 'progress' }, path = aliases[raw] || raw || 'today';
    if (aliases[raw]) history.replaceState(null, '', `#/` + path);
    document.querySelectorAll('.nav-link').forEach((link) => { const active = link.dataset.route === path || path === 'session' && link.dataset.route === 'today' || path === 'games' && link.dataset.route === 'exercises'; link.classList.toggle('is-active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    document.body.classList.toggle('is-training', path === 'session' || path === 'games' && param === 'delayed-memory');
    container.dataset.view = path;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (path === 'today') cleanup = today();
    else if (path === 'exercises') cleanup = exercises();
    else if (path === 'progress') renderProgress(container, repo);
    else if (path === 'backup') cleanup = renderBackup(container, repo);
    else if (path === 'settings') cleanup = renderSettings(container, repo);
    else if (path === 'session' && param) { cleanup = renderSession(container, { repo, controller, id: param, navigate, freshStart: freshSession === param }); freshSession = null; }
    else if (path === 'games' && param === 'delayed-memory') cleanup = renderMemory(container, { repo, controller, navigate });
    else if (path === 'games' && CATALOG.some((g) => g.id === param)) cleanup = exerciseIntro(param);
    else if (path === 'model') { const { renderModel } = await import('./views/model-view.js'); if (version === routeVersion) cleanup = renderModel(container, repo); }
    else if (path === 'diagnostics') { const { renderDiagnostics } = await import('./views/diagnostics-view.js'); if (version === routeVersion) cleanup = renderDiagnostics(container, repo, diagnostics); }
    else { navigate('today'); return; }
    syncPushState(repo).catch(() => showStatus('Push reminder sync is pending. Reopen Settings when online.'));
    const heading = container.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function today() {
    const scope = createSessionScope(), state = repo.snapshot(), m = progressMetrics(state);
    const active = Object.values(state.sessions).filter((s) => s.status === 'active');
    const journey = weeklyJourney(state);
    const todayDone = Object.values(state.workouts).some((w) => w.completedAt && (w.completedDate || w.date) === localDayKey() && !w.practice);
    const circuit = ['pattern-flash', 'math-arithmetic', 'logic-deduction', 'comprehension-inference'].map((id) => CATALOG.find((g) => g.id === id));
    container.innerHTML = `<div class="view-header"><div><h1 class="view-title">Today</h1><p class="view-desc">A little practice, every day.</p></div>${m.currentStreak ? `<span class="streak-pill">${m.currentStreak} day streak</span>` : ''}</div>
      ${state.migration?.quarantine.length ? `<p class="question-feedback">Some older progress needs review. <a href="#/backup">Open backup</a></p>` : ''}
      ${active.length ? `<section class="resume-card" aria-label="Continue your session">${active.map((s) => `<a href="#/session/${h(s.id)}"><span><small>Continue where you left off</small><strong>Resume ${h(s.kind === 'workout' ? 'workout' : CATALOG.find((g) => g.id === s.kind)?.title || s.kind)}</strong></span><span aria-hidden="true">→</span></a>`).join('')}</section>` : ''}
      <section class="daily-card" aria-labelledby="dailyTitle"><div class="daily-heading"><span class="eyebrow">DAILY WORKOUT</span><span class="text-muted">About 8 min</span></div>
        <h2 id="dailyTitle">${todayDone ? 'Nicely done today.' : 'Make a little room<br>for your mind.'}</h2>
        <p class="daily-description">${todayDone ? 'Your workout is saved. Come back tomorrow, or try another.' : 'Four short exercises. One fresh start.'}</p>
        <ol class="daily-skills">${circuit.map((g) => `<li><span class="exercise-icon" aria-hidden="true">${exerciseIcon(g.id)}</span><span>${skillLabel(g.domain)}</span></li>`).join('')}</ol>
        <div class="daily-actions"><button id="startCircuit" class="btn btn-primary btn-large">${todayDone ? 'Start another workout' : 'Start workout'} <span aria-hidden="true">→</span></button>
        <label class="practice-toggle"><input id="practiceWorkout" type="checkbox"> Practice without scoring</label></div></section>
      <section class="week-strip" aria-label="Your week"><div><h2>This week</h2><p>${journey.count} of 3 workouts</p></div><ol class="week-days">${journey.days.map(d => `<li class="${d.done ? 'is-earned' : ''} ${d.today ? 'is-today' : ''}"><small>${d.label}</small><span aria-hidden="true">${d.done ? '✓' : ''}</span><span class="sr-only">${d.done ? 'Completed' : 'Not completed'}${d.today ? ', today' : ''}</span></li>`).join('')}</ol></section>
      <a class="browse-link" href="#/exercises"><span>Have a skill in mind? <strong>Browse exercises</strong></span><span aria-hidden="true">→</span></a>
      ${state.memory?.status === 'committed' ? `<a class="browse-link" href="#/games/delayed-memory"><span>${Date.now() >= state.memory.readyAt ? 'Your memory recall is ready.' : 'Your memory set is saved for later.'} <strong>Open memory</strong></span><span aria-hidden="true">→</span></a>` : ''}`;
    scope.listen(container.querySelector('#startCircuit'), 'click', () => run(async () => {
      const button = container.querySelector('#startCircuit'); button.disabled = true;
      try {
        const practice = container.querySelector('#practiceWorkout').checked;
        const id = await controller.start('workout', { practice });
        if (!state.preferences.onboarded) await repo.setPreferences({ onboarded: true });
        if (scope.active) navigate(`session/${id}`);
      } finally { if (scope.active) button.disabled = false; }
    }));
    return scope.dispose;
  }
  function exercises() {
    const scope = createSessionScope();
    container.innerHTML = `<div class="view-header"><div><h1 class="view-title">Exercises</h1><p class="view-desc">Choose something to work on.</p></div></div>
      <div class="domain-filters" role="group" aria-label="Filter exercises">${[['all', 'All'], ['focus', 'Patterns'], ['memory', 'Memory'], ['math', 'Math'], ['logic', 'Logic'], ['comprehension', 'Reading']].map(([id, label]) => `<button class="filter-chip ${id === 'all' ? 'is-active' : ''}" data-filter="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('')}</div>
      <div class="exercise-grid">${CATALOG.map((g) => `<a class="exercise-card" data-domain="${g.domain}" href="#/games/${g.id}"><span class="exercise-icon" aria-hidden="true">${exerciseIcon(g.id)}</span><span class="exercise-card-copy"><h2>${h(g.title)}</h2><p>${h(g.summary)}</p><small>${h(g.timeEstimate.replace('mins', 'min'))}</small></span><span class="card-arrow" aria-hidden="true">→</span></a>`).join('')}</div>`;
    container.querySelectorAll('[data-filter]').forEach((button) => scope.listen(button, 'click', () => {
      container.querySelectorAll('[data-filter]').forEach((b) => { const active = b === button; b.classList.toggle('is-active', active); b.setAttribute('aria-pressed', String(active)); });
      container.querySelectorAll('[data-domain]').forEach((card) => { card.hidden = button.dataset.filter !== 'all' && card.dataset.domain !== button.dataset.filter; });
    }));
    return scope.dispose;
  }
  function exerciseIntro(game) {
    const scope = createSessionScope(), info = CATALOG.find((g) => g.id === game);
    const selectable = !['math-arithmetic', 'pattern-flash', 'corsi-span'].includes(game);
    const items = [...BASE_CONTENT, ...importedItems(repo.snapshot().content)].filter((q) => q.domain === domainFor(game));
    const choices = (key) => [...new Set(items.map((q) => q[key]))].sort().map((value) => `<option value="${h(value)}">${h(value.replaceAll('_', ' '))}</option>`).join('');
    container.innerHTML = `<a class="back-link" href="#/exercises">← Exercises</a><section class="exercise-setup"><span class="exercise-icon" aria-hidden="true">${exerciseIcon(game)}</span><h1 class="view-title">${h(info.title)}</h1><p class="view-desc">${h(exerciseGuide(game))}</p><p class="setup-time">${h(info.timeEstimate.replace('mins', 'min'))}</p>
      <button id="startExercise" class="btn btn-primary btn-large">Start exercise <span aria-hidden="true">→</span></button>
      <label class="practice-toggle"><input id="practiceExercise" type="checkbox"> Practice without scoring</label>
      ${selectable ? `<details class="exercise-options"><summary>Choose a topic</summary><div class="field"><label for="skillChoice">Skill</label><select id="skillChoice"><option value="">All skills</option>${choices('skill')}</select></div><div class="field"><label for="categoryChoice">Topic</label><select id="categoryChoice"><option value="">All topics</option>${choices('category')}</select></div></details>` : ''}</section>`;
    scope.listen(container.querySelector('#startExercise'), 'click', () => run(async () => {
      const practice = container.querySelector('#practiceExercise').checked; container.querySelector('#startExercise').disabled = true;
      try {
        const id = await controller.start(game, { practice, skill: container.querySelector('#skillChoice')?.value || undefined, category: container.querySelector('#categoryChoice')?.value || undefined });
        await controller.begin(id);
        if (scope.active) { freshSession = id; navigate(`session/${id}`); }
      }
      finally { if (scope.active) container.querySelector('#startExercise').disabled = false; }
    }));
    return scope.dispose;
  }
  window.addEventListener('hashchange', () => run(route)); window.addEventListener('pagehide', () => cleanup());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(checkReminder); });
  async function checkReminder() {
    if (document.hidden) return; await repo.refresh(); const due = dueReminder(repo.snapshot()); if (!due) return;
    await showBrowserReminder(repo.snapshot().preferences, due).catch(() => false);
    await repo.setPreferences({ lastReminder: due.id }); banner.innerHTML = `<p>${h(due.text)} <a href="#/${due.route}">Open memory practice</a> <button type="button" id="dismissReminder" class="btn btn-outline">Dismiss</button></p>`;
    banner.querySelector('#dismissReminder').onclick = () => { banner.textContent = ''; };
  }
  setInterval(() => run(checkReminder), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((registration) => {
    if (!navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(() => { document.body.dataset.offlineReady = 'true'; });
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showStatus('Update ready. Close all Sharp tabs, then reopen.'); }); });
  }).catch(() => showStatus('Offline setup failed. Reopen while online to retry.'));
  mountCoach(repo); await route(); await checkReminder();
}
