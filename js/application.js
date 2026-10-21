import { weeklyJourney } from './core/engagement.js';
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
  const sound = document.querySelector('#soundToggle');
  const soundLabel = () => sound.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Unmute sound'); soundLabel();
  sound.onclick = async () => { try { await repo.setPreferences({ sound: !audio.enabled }); audio.setEnabled(!audio.enabled); soundLabel(); } catch (e) { showStatus(e.message); } };
  document.querySelector('#themeToggle').onclick = async () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; try { await repo.setPreferences({ theme }); setTheme(theme); } catch (e) { showStatus(e.message); } };
  const unlock = () => { audio.prepare(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
  let cleanup = () => {}, routeVersion = 0;
  const navigate = (path) => { location.hash = `#/${path}`; };
  const run = async (action) => { try { await action(); } catch (e) { showStatus(e.message); diagnostics.record('app.warning', { code: e.name === 'QuotaExceededError' ? 'quota' : 'other' }); } };
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
    else if (path === 'model') { const { renderModel } = await import('./views/model-view.js'); if (version === routeVersion) cleanup = renderModel(container, repo); }
    else if (path === 'diagnostics') { const { renderDiagnostics } = await import('./views/diagnostics-view.js'); if (version === routeVersion) cleanup = renderDiagnostics(container, repo, diagnostics); }
    else { navigate('today'); return; }
    syncPushState(repo).catch(() => showStatus('Push reminder sync is pending. Reopen Settings when online.'));
    const heading = container.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function today() {
    const scope = createSessionScope(), state = repo.snapshot(), m = progressMetrics(state), active = Object.values(state.sessions).filter((s) => s.status === 'active');
    const journey = weeklyJourney(state);
    const todayDone = Object.values(state.workouts).some((w) => w.completedAt && (w.completedDate || w.date) === localDayKey() && !w.practice);
    container.innerHTML = `<div class="view-header"><div><h1 class="view-title">Today</h1><p class="view-desc">A few minutes. A sharper day.</p></div><div class="streak-pill">${m.currentStreak} day streak</div></div>
      ${!state.preferences.onboarded ? `<div class="workout-card"><h2>Welcome to Sharp</h2><p>Train a little each day. Progress stays on this device.</p><button id="finishWelcome" class="btn btn-primary">Let’s go</button></div>` : ''}
      ${state.migration?.quarantine.length ? `<p class="question-feedback">${state.migration.quarantine.length} older records need review. Originals are saved in your backup.</p>` : ''}
      ${active.length ? `<div class="workout-card"><h2>Pick up where you left off</h2><ul>${active.map((s) => `<li><a class="btn btn-outline" href="#/session/${h(s.id)}">Resume ${h(s.kind === 'workout' ? 'workout' : CATALOG.find((g) => g.id === s.kind)?.title || s.kind)} · exercise ${s.roundIndex + 1}</a></li>`).join('')}</ul></div>` : ''}
      <div class="workout-card expedition-hero"><div class="orbit-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="planet">✦</span><span class="satellite">✧</span></div><p class="eyebrow">TODAY’S EXPEDITION · ${h(journey.theme)}</p><p class="workout-card-badge">${todayDone ? 'Today’s workout is complete' : 'Daily circuit'}</p><h2>A little practice.<br>A new discovery.</h2><p>Your daily workout: memory, math, logic &amp; reading.</p><div class="skill-orbs" aria-hidden="true"><span>◈</span><span>＋</span><span>⌘</span><span>≋</span></div><p>4 exercises · About 8 minutes · Autosaved</p>
      <label><input id="practiceWorkout" type="checkbox"> Untimed practice · no ratings or streak</label><p><button id="startCircuit" class="btn btn-primary btn-large">${todayDone ? 'Start another workout' : 'Start workout'}</button></p></div>
      <section class="journey-card" aria-label="Weekly constellation"><div><p class="eyebrow">YOUR WEEKLY CONSTELLATION</p><h2>${journey.count >= 3 ? 'Your constellation is glowing ✦' : 'Small visits. Bright discoveries.'}</h2><p>${journey.count} of 3 weekly workouts · ${journey.count >= 3 ? 'Weekly explorer badge earned. Enjoy your progress!' : 'Complete three daily workouts this week to light your explorer badge.'} Miss a day? Just pick up here.</p></div><ol class="journey-days">${journey.days.map(d => `<li class="${d.done ? 'is-earned' : ''} ${d.today ? 'is-today' : ''}"><span aria-hidden="true">${d.done ? '✦' : '·'}</span><small>${d.label}</small><span class="sr-only">${d.done ? 'Completed' : 'Not completed'}${d.today ? ', today' : ''}</span></li>`).join('')}</ol><p class="journey-reward">${journey.count >= 3 ? '✺ Weekly explorer' : '✧ Explorer badge · 3 visits'}</p></section>
      <div class="discovery-grid"><div class="workout-card memory-discovery"><span class="discovery-symbol" aria-hidden="true">◷</span><h2>Time-capsule recall</h2><p>${state.memory?.status === 'committed' ? `Your study set ${Date.now() >= state.memory.readyAt ? 'is ready for recall.' : 'is saved for later.'}` : 'Study now. Recall later.'}</p><a class="btn btn-outline" href="#/games/delayed-memory">Open memory practice</a></div><div class="workout-card"><span class="discovery-symbol" aria-hidden="true">↗</span><h2>Follow your curiosity</h2><p>Explore ${BASE_CONTENT.length} questions across everyday decisions, reasoning and reading. Or take an untimed round.</p><a class="btn btn-outline" href="#/exercises">Explore exercises</a><p><a href="#/settings">Make room for a playful reminder →</a></p></div></div>`;
    scope.listen(container.querySelector('#finishWelcome') || new EventTarget(), 'click', () => run(async () => { await repo.setPreferences({ onboarded: true }); if (scope.active) route(); }));
    scope.listen(container.querySelector('#startCircuit'), 'click', () => run(async () => { const button = container.querySelector('#startCircuit'); button.disabled = true;
      const practice = container.querySelector('#practiceWorkout').checked; const id = await controller.start('workout', { practice }); if (scope.active) navigate(`session/${id}`); }));
    return scope.dispose;
  }
  function exercises() {
    const scope = createSessionScope();
    container.innerHTML = `<h1 class="view-title">Exercises</h1><p>Pick a skill.</p><label for="domainFilter">Domain</label><select id="domainFilter"><option value="all">All domains</option>${['memory', 'math', 'logic', 'comprehension', 'focus'].map((d) => `<option>${d}</option>`).join('')}</select><div class="games-grid">${CATALOG.map((g) => `<article class="game-catalog-card" data-domain="${g.domain}"><span class="card-domain-badge">${h(g.domain)}</span><h2>${h(g.title)}</h2><p>${h(g.summary)}</p><a class="btn btn-primary" href="#/games/${g.id}">Open ${h(g.title)}</a></article>`).join('')}</div>`;
    scope.listen(container.querySelector('#domainFilter'), 'change', (e) => container.querySelectorAll('[data-domain]').forEach((card) => { card.hidden = e.target.value !== 'all' && card.dataset.domain !== e.target.value; })); return scope.dispose;
  }
  function exerciseIntro(game) {
    const scope = createSessionScope(), info = CATALOG.find((g) => g.id === game);
    const selectable = !['math-arithmetic', 'pattern-flash', 'corsi-span'].includes(game);
    const items = [...BASE_CONTENT, ...importedItems(repo.snapshot().content)].filter((q) => q.domain === domainFor(game));
    const choices = (key) => [...new Set(items.map((q) => q[key]))].sort().map((value) => `<option value="${h(value)}">${h(value.replaceAll('_', ' '))}</option>`).join('');
    container.innerHTML = `<h1 class="view-title">${h(info.title)}</h1><div class="workout-card"><p>${h(info.summary)}</p><label><input id="practiceExercise" type="checkbox"> Untimed practice · unrated</label>
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
    await showBrowserReminder(repo.snapshot().preferences, due).catch(() => false);
    await repo.setPreferences({ lastReminder: due.id }); banner.innerHTML = `<p>${h(due.text)} <a href="#/${due.route}">Open memory practice</a> <button type="button" id="dismissReminder" class="btn btn-outline">Dismiss</button></p>`;
    banner.querySelector('#dismissReminder').onclick = () => { banner.textContent = ''; };
  }
  setInterval(() => run(checkReminder), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((registration) => {
    if (!navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(() => showStatus('Ready offline. Keep a backup.'));
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showStatus('Update ready. Close all Sharp tabs, then reopen.'); }); });
  }).catch(() => showStatus('Offline setup failed. Reopen while online to retry.'));
  mountCoach(repo); await route(); await checkReminder();
}
