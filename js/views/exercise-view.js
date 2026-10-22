import { createSessionScope } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { CATALOG } from '../content/catalog.js';
import { BASE_CONTENT, importedItems } from '../session/content.js';
import { domainFor } from '../session/controller.js';
import { exerciseIcon, exerciseGuide } from '../ui/exercise-presentation.js';

export function renderExercise(container, { repo, controller, game, openSession, run }) {
  const scope = createSessionScope(),
    info = CATALOG.find((g) => g.id === game);
  const selectable = !['math-arithmetic', 'pattern-flash', 'corsi-span'].includes(game);
  const items = [...BASE_CONTENT, ...importedItems(repo.snapshot().content)].filter(
    (q) => q.domain === domainFor(game)
  );
  const choices = (key) =>
    [...new Set(items.map((q) => q[key]))]
      .sort()
      .map((value) => `<option value="${h(value)}">${h(value.replaceAll('_', ' '))}</option>`)
      .join('');
  container.innerHTML = /* HTML */ `
    <a class="back-link" href="#/exercises">← Exercises</a>
    <section class="exercise-setup">
      <span class="exercise-icon" aria-hidden="true">${exerciseIcon(game)}</span>
      <h1 class="view-title">${h(info.title)}</h1>
      <p class="view-desc">${h(exerciseGuide(game))}</p>
      <p class="setup-time">${h(info.timeEstimate.replace('mins', 'min'))}</p>
      <button id="startExercise" class="btn btn-primary btn-large">
        Start exercise
        <span aria-hidden="true">→</span>
      </button>
      <label class="practice-toggle">
        <input id="practiceExercise" type="checkbox" />
        Practice without scoring
      </label>
      ${selectable
        ? `<details class="exercise-options"><summary>Choose a topic</summary><div class="field"><label for="skillChoice">Skill</label><select id="skillChoice"><option value="">All skills</option>${choices('skill')}</select></div><div class="field"><label for="categoryChoice">Topic</label><select id="categoryChoice"><option value="">All topics</option>${choices('category')}</select></div></details>`
        : ''}
    </section>
  `;
  scope.listen(container.querySelector('#startExercise'), 'click', () =>
    run(async () => {
      const practice = container.querySelector('#practiceExercise').checked;
      container.querySelector('#startExercise').disabled = true;
      try {
        const id = await controller.start(game, {
          practice,
          skill: container.querySelector('#skillChoice')?.value || undefined,
          category: container.querySelector('#categoryChoice')?.value || undefined,
        });
        await controller.begin(id);
        if (scope.active) {
          openSession(id);
        }
      } finally {
        if (scope.active) container.querySelector('#startExercise').disabled = false;
      }
    })
  );
  return scope.dispose;
}
