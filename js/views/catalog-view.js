import { createSessionScope } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { CATALOG } from '../content/catalog.js';
import { exerciseIcon } from '../ui/exercise-presentation.js';

export function renderCatalog(container) {
  const scope = createSessionScope();
  container.innerHTML = /* HTML */ `
    <div class="view-header">
      <div>
        <h1 class="view-title">Exercises</h1>
        <p class="view-desc">Choose something to work on.</p>
      </div>
    </div>
    <div class="domain-filters" role="group" aria-label="Filter exercises">
      ${[
        ['all', 'All'],
        ['focus', 'Patterns'],
        ['memory', 'Memory'],
        ['math', 'Math'],
        ['logic', 'Logic'],
        ['comprehension', 'Reading'],
      ]
        .map(
          ([id, label]) =>
            `<button class="filter-chip ${id === 'all' ? 'is-active' : ''}" data-filter="${id}" aria-pressed="${id === 'all'}">${label}</button>`
        )
        .join('')}
    </div>
    <div class="exercise-grid">
      ${CATALOG.map(
        (g) =>
          `<a class="exercise-card" data-domain="${g.domain}" href="#/games/${g.id}"><span class="exercise-icon" aria-hidden="true">${exerciseIcon(g.id)}</span><span class="exercise-card-copy"><h2>${h(g.title)}</h2><p>${h(g.summary)}</p><small>${h(g.timeEstimate.replace('mins', 'min'))}</small></span><span class="card-arrow" aria-hidden="true">→</span></a>`
      ).join('')}
    </div>
  `;
  container.querySelectorAll('[data-filter]').forEach((button) =>
    scope.listen(button, 'click', () => {
      container.querySelectorAll('[data-filter]').forEach((b) => {
        const active = b === button;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      container.querySelectorAll('[data-domain]').forEach((card) => {
        card.hidden =
          button.dataset.filter !== 'all' && card.dataset.domain !== button.dataset.filter;
      });
    })
  );
  return scope.dispose;
}
