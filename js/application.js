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
  if (preferences.theme) setTheme(preferences.theme);
  audio.enabled = preferences.sound !== false; haptics.enabled = preferences.haptics !== false;
  const sound = document.querySelector('#soundToggle');
  const soundLabel = () => sound.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Unmute sound'); soundLabel();
  sound.onclick = async () => { try { await repo.setPreferences({ sound: !audio.enabled }); audio.setEnabled(!audio.enabled); soundLabel(); } catch (e) { showStatus(e.message); } };
  document.querySelector('#themeToggle').onclick = async () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; try { await repo.setPreferences({ theme }); setTheme(theme); } catch (e) { showStatus(e.message); } };
  const unlock = () => { audio.prepare(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
  let cleanup = () => {}, routeVersion = 0;
  const navigate = (path) => { location.hash = `#/${path}`; };
  const run = async (action) => { try { await action(); } catch (e) { showStatus(e.message); } };
  async function route() {
    const version = ++routeVersion; cleanup(); cleanup = () => {};
    await repo.refresh(); if (version !== routeVersion) return;
    const [raw = 'today', param] = location.hash.replace(/^#\/?/, '').split('/');
    const aliases = { workout: 'today', catalog: 'exercises', analytics: 'progress' }, path = aliases[raw] || raw || 'today';
    if (aliases[raw]) history.replaceState(null, '', `#/` + path);
    document.querySelectorAll('.nav-link').forEach((link) => { const active = link.dataset.route === path || path === 'session' && link.dataset.route === 'today' || path === 'games' && link.dataset.route === 'exercises'; link.classList.toggle('is-active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (path === 'today') cleanup = today();
    else if (path === 'exercises') cleanup = exercises();
    else if (path === 'progress') renderProgress(container, repo);
    else if (path === 'backup') cleanup = renderBackup(container, repo);
    else if (path === 'settings') cleanup = renderSettings(container, repo);
    else if (path === 'session' && param) cleanup = renderSession(container, { repo, controller, id: param, navigate });
    else if (path === 'games' && param === 'delayed-memory') cleanup = renderMemory(container, { repo, controller, navigate });
    else if (path === 'games' && CATALOG.some((g) => g.id === param)) cleanup = exerciseIntro(param);
    else if (path === 'diagnostics') { const { renderDiagnostics } = await import('./views/diagnostics-view.js'); if (version === routeVersion) cleanup = renderDiagnostics(container, repo); }
    else { navigate('today'); return; }
    const heading = container.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function today() {
    const scope = createSessionScope(), state = repo.snapshot(), m = progressMetrics(state), active = Object.values(state.sessions).filter((s) => s.status === 'active');
    const todayDone = Object.values(state.workouts).some((w) => w.completedAt && w.date === localDayKey() && !w.practice);
    container.innerHTML = `<div class="view-header"><div><h1 class="view-title">Today</h1><p class="view-desc">A little focused practice, at your pace.</p></div><div class="streak-pill">${m.currentStreak} day local streak</div></div>
      ${!state.preferences.onboarded ? `<div class="workout-card"><h2>Welcome to Sharp</h2><p>Practise memory, arithmetic, logic and reading. Your progress stays in this browser. Offline training works after the app cache is installed; keep backups to protect against storage being cleared.</p><p>There are no model downloads or developer uploads in this release. Reminders work while the app is open; calendar reminders are available in Settings.</p><button id="finishWelcome" class="btn btn-primary">Got it, let’s practise</button><a href="#/settings" class="btn btn-outline">Storage &amp; reminder options</a></div>` : ''}
      ${state.migration?.quarantine.length ? `<p class="question-feedback">${state.migration.quarantine.length} legacy records were quarantined. Original bytes are retained in your v2 backup; valid progress was migrated.</p>` : ''}
      ${active.length ? `<div class="workout-card"><h2>Continue where you left off</h2><ul>${active.map((s) => `<li><a class="btn btn-outline" href="#/session/${h(s.id)}">Resume ${h(s.kind === 'workout' ? 'workout' : CATALOG.find((g) => g.id === s.kind)?.title || s.kind)} · exercise ${s.roundIndex + 1}</a></li>`).join('')}</ul></div>` : ''}
      <div class="workout-card"><p class="workout-card-badge">${todayDone ? 'Today’s workout is complete' : 'Daily circuit'}</p><h2>Four ways to practise</h2><p>Pattern memory → Arithmetic → Logic → Reading. About 8 minutes, with a saved checkpoint after every answer. You can leave and resume.</p><p>Pause during a memory exposure restarts that trial. Earlier answers remain saved.</p>
      <label><input id="practiceWorkout" type="checkbox"> Untimed practice (does not affect ratings or daily streak)</label><p><button id="startCircuit" class="btn btn-primary btn-large">${todayDone ? 'Start another workout' : 'Start workout'}</button></p></div>
      <div class="workout-card"><h2>Time-capsule recall</h2><p>${state.memory?.status === 'committed' ? `Your saved study set ${Date.now() >= state.memory.readyAt ? 'is ready for recall.' : 'is waiting for its recall interval.'}` : 'Study a new themed set now and return for delayed recall.'}</p><a class="btn btn-outline" href="#/games/delayed-memory">Open memory practice</a></div>`;
    scope.listen(container.querySelector('#finishWelcome') || new EventTarget(), 'click', () => run(async () => { await repo.setPreferences({ onboarded: true }); if (scope.active) route(); }));
    scope.listen(container.querySelector('#startCircuit'), 'click', () => run(async () => { const button = container.querySelector('#startCircuit'); button.disabled = true;
      const practice = container.querySelector('#practiceWorkout').checked; const id = await controller.start('workout', { practice }); if (scope.active) navigate(`session/${id}`); }));
    return scope.dispose;
  }
  function exercises() {
    const scope = createSessionScope();
    container.innerHTML = `<h1 class="view-title">Exercises</h1><p>Choose a skill, or use practice mode to explore without changing ratings.</p><label for="domainFilter">Filter by domain</label><select id="domainFilter"><option value="all">All domains</option>${['memory', 'math', 'logic', 'comprehension', 'focus'].map((d) => `<option>${d}</option>`).join('')}</select><div class="games-grid">${CATALOG.map((g) => `<article class="game-catalog-card" data-domain="${g.domain}"><span class="card-domain-badge">${h(g.domain)}</span><h2>${h(g.title)}</h2><p>${h(g.summary)}</p><a class="btn btn-primary" href="#/games/${g.id}">Open ${h(g.title)}</a></article>`).join('')}</div>`;
    scope.listen(container.querySelector('#domainFilter'), 'change', (e) => container.querySelectorAll('[data-domain]').forEach((card) => { card.hidden = e.target.value !== 'all' && card.dataset.domain !== e.target.value; })); return scope.dispose;
  }
  function exerciseIntro(game) {
    const scope = createSessionScope(), info = CATALOG.find((g) => g.id === game);
    const selectable = !['math-arithmetic', 'pattern-flash', 'corsi-span'].includes(game);
    const items = [...BASE_CONTENT, ...importedItems(repo.snapshot().content)].filter((q) => q.domain === domainFor(game));
    const choices = (key) => [...new Set(items.map((q) => q[key]))].sort().map((value) => `<option value="${h(value)}">${h(value.replaceAll('_', ' '))}</option>`).join('');
    container.innerHTML = `<h1 class="view-title">${h(info.title)}</h1><div class="workout-card"><p>${h(info.summary)}</p><p>You’ll see instructions and an example before the first question. Responses are saved individually. This is cognitive practice, not a validated assessment.</p><label><input id="practiceExercise" type="checkbox"> Untimed practice (unrated)</label>
      ${selectable ? `<p><label for="skillChoice">Skill</label><select id="skillChoice"><option value="">Balanced coverage</option>${choices('skill')}</select></p><p><label for="categoryChoice">Category</label><select id="categoryChoice"><option value="">All categories</option>${choices('category')}</select></p>` : ''}
      <p><button id="startExercise" class="btn btn-primary">Start exercise</button><a class="btn btn-outline" href="#/exercises">Back to Exercises</a></p></div>`;
    scope.listen(container.querySelector('#startExercise'), 'click', () => run(async () => { const practice = container.querySelector('#practiceExercise').checked; container.querySelector('#startExercise').disabled = true;
      try { const id = await controller.start(game, { practice, skill: container.querySelector('#skillChoice')?.value || undefined, category: container.querySelector('#categoryChoice')?.value || undefined }); if (scope.active) navigate(`session/${id}`); }
      finally { if (scope.active) container.querySelector('#startExercise').disabled = false; } })); return scope.dispose;
  }
  window.addEventListener('hashchange', () => run(route)); window.addEventListener('pagehide', () => cleanup());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(checkReminder); });
  async function checkReminder() {
    if (document.hidden) return; await repo.refresh(); const due = dueReminder(repo.snapshot()); if (!due) return;
    await repo.setPreferences({ lastReminder: due.id }); banner.innerHTML = `<p>${h(due.text)} <a href="#/${due.route}">Open memory practice</a> <button type="button" id="dismissReminder" class="btn btn-outline">Dismiss</button></p>`;
    banner.querySelector('#dismissReminder').onclick = () => { banner.textContent = ''; };
  }
  setInterval(() => run(checkReminder), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((registration) => {
    if (!navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(() => showStatus('Offline cache installed. Keep a backup of your local progress.'));
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showStatus('Update ready. Save and close every Sharp tab, then reopen to use it.'); }); });
  }).catch(() => showStatus('Offline setup could not finish. Keep this tab online and reopen Sharp to retry.'));
  await route(); await checkReminder();
}
