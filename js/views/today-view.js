import { createSessionScope } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { CATALOG } from '../content/catalog.js';
import { weeklyJourney } from '../core/engagement.js';
import { progressMetrics } from '../session/metrics.js';
import { localDayKey } from '../core/calendar.js';
import { CIRCUIT } from '../session/controller.js';
import { exerciseIcon, skillLabel } from '../ui/exercise-presentation.js';

export function renderToday(container, { repo, controller, navigate, run }) {
  const scope = createSessionScope(),
    state = repo.snapshot(),
    m = progressMetrics(state);
  const active = Object.values(state.sessions).filter((s) => s.status === 'active');
  const journey = weeklyJourney(state);
  const todayDone = Object.values(state.workouts).some(
    (w) => w.completedAt && (w.completedDate || w.date) === localDayKey() && !w.practice
  );
  const circuit = CIRCUIT.map((id) => CATALOG.find((g) => g.id === id));
  container.innerHTML = /* HTML */ `
    <div class="view-header">
      <div>
        <h1 class="view-title">Today</h1>
        <p class="view-desc">A little practice, every day.</p>
      </div>
      ${m.currentStreak ? `<span class="streak-pill">${m.currentStreak} day streak</span>` : ''}
    </div>
    ${state.migration?.quarantine.length
      ? `<p class="question-feedback">Some older progress needs review. <a href="#/backup">Open backup</a></p>`
      : ''}
    ${active.length
      ? `<section class="resume-card" aria-label="Continue your session">${active.map((s) => `<a href="#/session/${h(s.id)}"><span><small>Continue where you left off</small><strong>Resume ${h(s.kind === 'workout' ? 'workout' : CATALOG.find((g) => g.id === s.kind)?.title || s.kind)}</strong></span><span aria-hidden="true">→</span></a>`).join('')}</section>`
      : ''}
    <section class="daily-card" aria-labelledby="dailyTitle">
      <div class="daily-heading">
        <span class="eyebrow">DAILY WORKOUT</span>
        <span class="text-muted">About 8 min</span>
      </div>
      <h2 id="dailyTitle">
        ${todayDone ? 'Nicely done today.' : 'Make a little room<br>for your mind.'}
      </h2>
      <p class="daily-description">
        ${todayDone
          ? 'Your workout is saved. Come back tomorrow, or try another.'
          : 'Four short exercises. One fresh start.'}
      </p>
      <ol class="daily-skills">
        ${circuit
          .map(
            (g) =>
              `<li><span class="exercise-icon" aria-hidden="true">${exerciseIcon(g.id)}</span><span>${skillLabel(g.domain)}</span></li>`
          )
          .join('')}
      </ol>
      <div class="daily-actions">
        <button id="startCircuit" class="btn btn-primary btn-large">
          ${todayDone ? 'Start another workout' : 'Start workout'}
          <span aria-hidden="true">→</span>
        </button>
        <label class="practice-toggle">
          <input id="practiceWorkout" type="checkbox" />
          Practice without scoring
        </label>
      </div>
    </section>
    <section class="week-strip" aria-label="Your week">
      <div>
        <h2>This week</h2>
        <p>${journey.count} of 3 workouts</p>
      </div>
      <ol class="week-days">
        ${journey.days
          .map(
            (d) =>
              `<li class="${d.done ? 'is-earned' : ''} ${d.today ? 'is-today' : ''}"><small>${d.label}</small><span aria-hidden="true">${d.done ? '✓' : ''}</span><span class="sr-only">${d.done ? 'Completed' : 'Not completed'}${d.today ? ', today' : ''}</span></li>`
          )
          .join('')}
      </ol>
    </section>
    <a class="browse-link" href="#/exercises">
      <span>
        Have a skill in mind?
        <strong>Browse exercises</strong>
      </span>
      <span aria-hidden="true">→</span>
    </a>
    ${state.memory?.status === 'committed'
      ? `<a class="browse-link" href="#/games/delayed-memory"><span>${Date.now() >= state.memory.readyAt ? 'Your memory recall is ready.' : 'Your memory set is saved for later.'} <strong>Open memory</strong></span><span aria-hidden="true">→</span></a>`
      : ''}
  `;
  scope.listen(container.querySelector('#startCircuit'), 'click', () =>
    run(async () => {
      const button = container.querySelector('#startCircuit');
      button.disabled = true;
      try {
        const practice = container.querySelector('#practiceWorkout').checked;
        const id = await controller.start('workout', { practice });
        if (!state.preferences.onboarded) await repo.setPreferences({ onboarded: true });
        if (scope.active) navigate(`session/${id}`);
      } finally {
        if (scope.active) button.disabled = false;
      }
    })
  );
  return scope.dispose;
}
