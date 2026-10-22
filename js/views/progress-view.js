import { progressMetrics } from '../session/metrics.js';
import { escapeHTML as h } from '../content-validation.js';
import { CATALOG } from '../content/catalog.js';
import { skillLabel } from '../ui/exercise-presentation.js';
export function renderProgress(container, repo) {
  const state = repo.snapshot(),
    m = progressMetrics(state),
    rounds = Object.values(state.rounds).sort((a, b) => b.timestamp - a.timestamp);
  const retention = state.memoryHistory || [];
  const scored = Object.values(state.attempts).filter((a) => !a.practice && !a.interrupted);
  container.innerHTML = /* HTML */ `
    <div class="view-header">
      <div>
        <h1 class="view-title">Progress</h1>
        <p class="view-desc">Your practice, over time.</p>
      </div>
    </div>
    <div class="workout-card">
      <h2>${m.eligible ? `${m.correct} of ${m.eligible} correct` : 'No scored results yet'}</h2>
      <p>
        ${m.eligible
          ? `${Math.round(m.accuracy * 100)}% accuracy · practice excluded`
          : 'Your results will appear after your first scored exercise.'}
      </p>
      ${rounds.length
        ? `<p>${m.workoutCount}/${m.startedCount} workouts · ${m.currentStreak} day streak · best ${m.longestStreak}</p>`
        : '<a class="btn btn-primary" href="#/exercises">Find an exercise</a>'}
      ${m.partialScore !== null ? `<p>Pattern match: ${Math.round(m.partialScore * 100)}%</p>` : ''}
    </div>
    ${scored.length
      ? `<div class="settings-card"><h2>By skill</h2><table><caption class="sr-only">Current rating and scored answers</caption><thead><tr><th scope="col">Skill</th><th scope="col">Rating</th><th scope="col">Answers</th></tr></thead><tbody>${Object.entries(
          m.ratings
        )
          .filter(([domain]) => scored.some((a) => a.domain === domain))
          .map(
            ([domain, rating]) =>
              `<tr><th scope="row">${h(domain === 'focus' ? 'Patterns' : skillLabel(domain))}</th><td>${rating}</td><td>${scored.filter((a) => a.domain === domain).length}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : ''}
    ${rounds.length
      ? `<div class="settings-card"><h2>Recent sessions</h2><ul class="session-history">${rounds
          .slice(0, 8)
          .map(
            (r) =>
              `<li><span><strong>${h(CATALOG.find((g) => g.id === r.game)?.title || r.game)}</strong><small>${h(r.date)}${r.practice ? ' · Practice' : ''}</small></span><span>${Math.round((r.score / r.count) * 100)}%</span></li>`
          )
          .join('')}</ul></div>`
      : ''}
    ${retention.length
      ? `<details class="settings-card"><summary>Memory recall</summary><ul>${retention
          .slice(-10)
          .reverse()
          .map(
            (r) =>
              `<li>${h(r.mode)} · ${(r.actualDelayMs / 3600000).toFixed(2)} hours actual delay · ${h(r.bucket || 'practice')}${r.practice ? ' · unrated' : ''}</li>`
          )
          .join('')}</ul></details>`
      : ''}
    ${m.dailyScores.length || m.slices.length || m.speedCount
      ? `<details class="settings-card"><summary>Detailed trends</summary>
      ${m.speedCount ? `<h2>Response time</h2><p>${(m.medianMs / 1000).toFixed(1)}s typical · ${(m.p90Ms / 1000).toFixed(1)}s at the 90th percentile · ${m.speedCount} correct answers</p>` : ''}
      ${m.dailyScores.length ? `<h2>Daily rating</h2><table><thead><tr><th scope="col">Date</th><th scope="col">Rating</th></tr></thead><tbody>${m.dailyScores.map((d) => `<tr><th scope="row">${d.date}</th><td>${d.score}</td></tr>`).join('')}</tbody></table>` : ''}
      ${m.slices.length ? `<div class="table-scroll"><table><caption>Comparable practice windows</caption><thead><tr><th scope="col">Skill / level / input</th><th scope="col">Answers / items</th><th scope="col">Accuracy, earlier → recent</th><th scope="col">Typical time</th></tr></thead><tbody>${m.slices.map((s) => `<tr><th scope="row">${h(s.skill.replaceAll('_', ' '))} / ${s.tier} / ${h(s.inputMode)}</th><td>${s.count} / ${s.distinctItems}</td><td>${s.enough ? `${Math.round(s.previousAccuracy * 100)}% → ${Math.round(s.recentAccuracy * 100)}%` : '20 answers needed'}</td><td>${s.previousMs !== null ? `${(s.previousMs / 1000).toFixed(1)}s → ${(s.recentMs / 1000).toFixed(1)}s` : 'More practice needed'}</td></tr>`).join('')}</tbody></table></div>` : ''}</details>`
      : ''}
    ${m.legacyRoundCount || m.legacyStreak
      ? `<details class="settings-card"><summary>Older progress</summary><p>${m.legacyRoundCount} rounds · ${m.legacyStreak?.current || 0} day streak · best ${m.legacyStreak?.longest || 0}</p><p>Original totals and dates are preserved in your backup.</p></details>`
      : ''}
    <details class="settings-card">
      <summary>How scores work</summary>
      <p>
        Ratings help choose your next challenge. They are not assessments. Practice and interrupted
        questions do not affect accuracy. Pattern matching is scored separately.
      </p>
      <p>
        Response times exclude reading, pauses and hidden tabs. Trends compare the previous 10 and
        latest 10 answers at the same level and settings. Speed trends need five correct answers per
        window.
      </p>
    </details>
  `;
}
