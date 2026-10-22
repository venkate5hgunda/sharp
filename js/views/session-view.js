import { exerciseIcon } from '../ui/exercise-presentation.js';
import { createSessionScope, bindChoiceShortcuts } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { projectRatings } from '../session/metrics.js';
import { CATALOG } from '../content/catalog.js';
import { createQuestionTimer } from '../session/timing.js';

const titleFor = (id) => CATALOG.find((g) => g.id === id)?.title || id;
export function renderSession(container, { repo, controller, id, navigate, freshStart = false }) {
  const scope = createSessionScope();
  let child = () => {},
    paused = false,
    busy = false,
    error = '';
  let getTiming = () => null;
  scope.listen(container, 'keydown', (event) => {
    if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault();
  });
  scope.addCleanup(() => child());
  scope.addCleanup(() => {
    const save =
      current()?.status === 'active'
        ? controller.interrupt(id, getTiming()).catch(() => {})
        : Promise.resolve();
    save.finally(() => controller.release(id).catch(() => {}));
  });
  function current() {
    return repo.snapshot().sessions[id];
  }
  async function act(action) {
    if (busy || !scope.active) return;
    busy = true;
    error = '';
    container.querySelectorAll('button').forEach((b) => {
      b.disabled = true;
    });
    try {
      await action();
    } catch (cause) {
      error = cause.message;
    }
    busy = false;
    if (scope.active) draw();
  }
  async function heartbeat() {
    if (!scope.active) return;
    try {
      if (!document.hidden && !paused && current()?.status === 'active')
        await controller.heartbeat(id);
    } catch (cause) {
      paused = true;
      error = cause.message;
      if (scope.active) draw();
    }
    scope.timeout(heartbeat, 15000);
  }
  scope.listen(document, 'visibilitychange', () => {
    if (!document.hidden || paused || current()?.status !== 'active') return;
    paused = true;
    child();
    controller
      .interrupt(id, getTiming(), true)
      .catch((cause) => {
        error = cause.message;
      })
      .finally(() => {
        if (scope.active) draw();
      });
  });
  function draw() {
    child();
    const part = createSessionScope();
    child = part.dispose;
    const s = current();
    if (!s) {
      container.innerHTML = '<h1>Session unavailable</h1><a href="#/today">Return to Today</a>';
      return;
    }
    const round = s.rounds[s.roundIndex];
    if (['feedback', 'summary'].includes(round.phase))
      window.dispatchEvent(new Event('sharp:coach-context'));
    const completed = round.phase === 'summary' ? round.items.length : round.position;
    container.innerHTML = /* HTML */ `
      <header class="session-header">
        <div class="session-toolbar">
          <a href="#/today" class="session-exit">
            ←
            <span>Save &amp; exit</span>
          </a>
          <div class="session-title">
            <h1 id="sessionTitle">${h(titleFor(round.game))}</h1>
            <p>
              ${s.kind === 'workout'
                ? `Exercise ${s.roundIndex + 1} of ${s.rounds.length}`
                : round.practice
                  ? 'Practice'
                  : 'Exercise'}
            </p>
          </div>
          ${s.status === 'active' && !paused && !error
            ? '<button id="pauseSession" class="btn btn-outline" type="button">Pause</button>'
            : '<span></span>'}
        </div>
        <progress
          class="session-progress"
          max="${round.items.length}"
          value="${completed}"
          aria-label="Exercise progress"
        >
          ${completed} of ${round.items.length}
        </progress>
        <p id="sessionError" role="alert" ${error ? '' : 'hidden'}>${h(error)}</p>
      </header>
      <div id="sessionStage" role="region" aria-labelledby="sessionTitle"></div>
    `;
    part.listen(container.querySelector('#pauseSession') || new EventTarget(), 'click', () =>
      act(async () => {
        await controller.interrupt(id, getTiming());
        paused = true;
      })
    );
    const stage = container.querySelector('#sessionStage');
    if (paused || error) {
      stage.innerHTML = /* HTML */ `
        <div class="workout-card session-message">
          <h2 tabindex="-1">Session paused</h2>
          <p>Your progress is saved.</p>
          <button id="resumeSession" class="btn btn-primary">Resume session</button>
          ${/another tab/i.test(error)
            ? '<button id="takeoverSession" class="btn btn-outline">Take over from another tab</button>'
            : ''}
        </div>
      `;
      stage.querySelector('h2').focus({ preventScroll: true });
      part.listen(stage.querySelector('#resumeSession'), 'click', () =>
        act(async () => {
          await controller.claim(id);
          paused = false;
        })
      );
      part.listen(stage.querySelector('#takeoverSession') || new EventTarget(), 'click', () =>
        act(async () => {
          await controller.claim(id, true);
          paused = false;
        })
      );
      return;
    }
    if (round.phase === 'intro') {
      const example =
        round.game === 'pattern-flash'
          ? 'Remember the highlighted squares. After they disappear, tap the same squares.'
          : round.game === 'corsi-span'
            ? 'Watch the squares light up. Then tap them in the same order.'
            : round.game === 'delayed-memory'
              ? 'Decide whether each word was in your study set.'
              : round.game.includes('math')
                ? 'Solve each problem and choose your answer.'
                : round.game === 'logic-deduction'
                  ? 'Read the facts. Choose what must be true.'
                  : 'Read, then answer using the passage.';
      stage.innerHTML = /* HTML */ `
        <div class="workout-card session-message">
          <span class="exercise-icon" aria-hidden="true">${exerciseIcon(round.game)}</span>
          <h2>Quick guide</h2>
          <p>${example}</p>
          ${round.game === 'pattern-flash' && !round.practice
            ? '<p class="helper-text">Ignore the second, distracting pattern.</p>'
            : ''}
          <button id="beginRound" class="btn btn-primary btn-large">Begin exercise</button>
        </div>
      `;
      stage.querySelector('#beginRound').focus({ preventScroll: true });
      part.listen(stage.querySelector('#beginRound'), 'click', () =>
        act(() => controller.begin(id))
      );
    } else if (round.phase === 'summary') {
      const state = repo.snapshot(),
        result = state.rounds[`${id}:${s.roundIndex}`],
        transition = projectRatings(state).transitions[result.id];
      stage.innerHTML = /* HTML */ `
        <div class="result-summary-card session-message">
          <span class="completion-mark" aria-hidden="true">✓</span>
          <h2 tabindex="-1">
            ${s.status === 'completed' ? 'Session complete' : 'Exercise complete'}
          </h2>
          <p class="result-score">
            ${Math.round((result.score / result.count) * 100)}
            <span>%</span>
          </p>
          <p>
            ${round.game === 'pattern-flash' ? 'Pattern match' : 'Accuracy'} · ${result.count}
            answers
          </p>
          ${transition
            ? `<details><summary>Rating ${transition.after} (${transition.delta >= 0 ? '+' : ''}${transition.delta})</summary><p>Previous rating: ${transition.before}. Ratings help choose your next challenge.</p></details>`
            : '<p class="helper-text">Practice saved</p>'}
          <button id="roundDone" class="btn btn-primary">
            ${s.status === 'completed' ? 'View progress' : 'Next exercise'}
          </button>
        </div>
      `;
      stage.querySelector('h2').focus({ preventScroll: true });
      part.listen(stage.querySelector('#roundDone'), 'click', () =>
        s.status === 'completed' ? navigate('progress') : act(() => controller.nextRound(id))
      );
    } else if (round.phase === 'feedback') renderFeedback(stage, round, s, part);
    else if (['pattern-flash', 'corsi-span'].includes(round.game))
      renderVisual(stage, round, s, part);
    else renderQuestion(stage, round, s, part);
  }
  function renderQuestion(stage, round, s, part) {
    const q = round.items[round.position];
    const timer = createQuestionTimer({
      initial: round.pendingTiming,
      reading: Boolean(q.passage),
    });
    getTiming = timer.read;
    stage.innerHTML = /* HTML */ `
      <div class="question-card ${round.game === 'math-arithmetic' ? 'is-arithmetic' : ''}">
        <p class="question-counter">Question ${round.position + 1} of ${round.items.length}</p>
        ${q.passage
          ? `<div id="readingPhase"><div class="question-scroll" tabindex="0" role="region" aria-label="Reading passage"><h2>${h(q.title)}</h2><div class="comprehension-passage">${h(q.passage)}</div></div><button id="readingDone" class="btn btn-primary">Ready for the question</button></div>`
          : ''}
        <div id="answerPhase" ${q.passage ? 'hidden' : ''}>
          <div class="question-scroll" tabindex="0" role="region" aria-label="Question">
            ${q.premises?.length
              ? `<ul class="premises-list">${q.premises.map((p) => `<li>${h(p)}</li>`).join('')}</ul>`
              : ''}
            ${q.prompt && q.prompt !== q.question
              ? `<p class="question-context">${h(q.prompt)}</p>`
              : ''}
            <h2 id="questionPrompt">${h(q.question || q.prompt)}</h2>
            ${q.passage
              ? `<details class="passage-review"><summary>Read passage again</summary><p>${h(q.passage)}</p></details>`
              : ''}
          </div>
          <div class="logic-options-grid" role="group" aria-labelledby="questionPrompt">
            ${q.options
              .map(
                (o, i) =>
                  `<button type="button" class="btn logic-option-btn" data-val="${h(o.id)}"><span class="opt-key">${i + 1}</span><span>${h(o.text)}</span></button>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
    const review = stage.querySelector('.passage-review');
    if (review) part.listen(review, 'toggle', () => timer.setReading(review.open));
    const btns = stage.querySelectorAll('[data-val]');
    let submitted = false,
      shortcut = () => {};
    const choose = (value, inputMode = 'keyboard') => {
      if (submitted || stage.querySelector('#answerPhase').hidden) return;
      submitted = true;
      shortcut();
      act(() =>
        controller.answer(
          id,
          value,
          { ...getTiming(), inputMode },
          { roundIndex: s.roundIndex, position: round.position }
        )
      );
    };
    btns.forEach((button) =>
      part.listen(button, 'click', (e) =>
        choose(button.dataset.val, e.detail === 0 ? 'keyboard' : 'pointer')
      )
    );
    const enable = () => {
      shortcut = bindChoiceShortcuts(part, btns, (value) => choose(value, 'keyboard'));
      btns[0]?.focus({ preventScroll: true });
    };
    if (q.passage)
      part.listen(stage.querySelector('#readingDone'), 'click', () => {
        timer.setReading(false);
        stage.querySelector('#readingPhase').hidden = true;
        stage.querySelector('#answerPhase').hidden = false;
        enable();
      });
    else enable();
    if (q.passage) stage.querySelector('#readingDone').focus({ preventScroll: true });
  }
  function renderFeedback(stage, round, s, part) {
    const q = round.items[round.position],
      attempt = repo.snapshot().attempts[`${id}:${s.roundIndex}:${round.position}`];
    const correct = q.options?.find((o) => o.id === q.correctOptionId)?.text;
    const selected = q.options?.find((o) => o.id === attempt.response)?.text;
    stage.innerHTML = /* HTML */ `
      <div class="workout-card session-message feedback-card">
        <span class="feedback-mark ${attempt.score === 1 ? 'is-correct' : ''}" aria-hidden="true">
          ${attempt.score === 1 ? '✓' : '→'}
        </span>
        <h2 tabindex="-1">
          ${attempt.score === 1
            ? 'Correct'
            : round.game === 'pattern-flash'
              ? `${Math.round(attempt.score * 100)}% match`
              : 'Keep practising'}
        </h2>
        <div class="question-feedback" role="status">
          ${selected && attempt.score !== 1 ? `<p>Your answer: ${h(selected)}</p>` : ''}
          ${correct
            ? `<p>Answer: <strong>${h(correct)}</strong></p>`
            : `<p>${h(round.game === 'corsi-span' ? `Sequence: ${q.sequence.map((n) => String.fromCharCode(65 + n)).join(' → ')}` : `Target cells: ${q.sequence.map((n) => n + 1).join(', ')}`)}</p>`}
          ${q.explanation
            ? `<details><summary>Explanation</summary><p>${h(q.explanation)}</p></details>`
            : ''}
        </div>
        <button id="nextQuestion" class="btn btn-primary">
          ${round.position === round.items.length - 1 ? 'View results' : 'Next question'}
        </button>
      </div>
    `;
    stage.querySelector('#nextQuestion').focus({ preventScroll: true });
    part.listen(stage.querySelector('#nextQuestion'), 'click', () =>
      act(() => controller.next(id))
    );
    part.listen(stage, 'keydown', (event) => {
      if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault();
    });
  }
  function renderVisual(stage, round, s, part) {
    getTiming = () => null;
    const q = round.items[round.position],
      pattern = round.game === 'pattern-flash',
      chosen = [];
    let submitted = false;
    const buttons = () => [...stage.querySelectorAll('[data-cell]')];
    const grid = () =>
      `<div class="${pattern ? `pattern-grid grid-${q.gridSize}` : 'pattern-grid grid-3'}" role="group" aria-label="${pattern ? 'Pattern' : 'Sequence'} cells">${Array.from({ length: q.size }, (_, i) => `<button class="cell interactive-cell" data-cell="${i}" aria-label="${pattern ? `Cell ${i + 1}` : `Block ${String.fromCharCode(65 + i)}`}" aria-pressed="false" disabled>${pattern ? i + 1 : String.fromCharCode(65 + i)}</button>`).join('')}</div>`;
    stage.innerHTML = /* HTML */ `
      <div class="workout-card visual-card">
        <p class="question-counter">Round ${round.position + 1} of ${round.items.length}</p>
        <h2 id="visualStatus" aria-live="polite">
          Watch ${pattern ? 'the pattern' : 'the sequence'}
        </h2>
        <div class="visual-board">${grid()}</div>
        <div id="visualControls"></div>
      </div>
    `;
    const status = stage.querySelector('#visualStatus'),
      controls = stage.querySelector('#visualControls');
    const recall = () => {
      buttons().forEach((b) => {
        b.classList.remove('is-lit');
        b.disabled = false;
      });
      status.textContent = pattern
        ? 'Tap the squares you remember'
        : `Repeat ${q.sequence.length} blocks in order`;
      controls.innerHTML =
        '<p id="selectionStatus" role="status">Tap a square to start.</p><div class="visual-actions"><button id="clearVisual" class="btn btn-outline" disabled>Clear selection</button><button id="submitVisual" class="btn btn-primary" disabled>Submit response</button></div>';
      const start = performance.now();
      buttons().forEach((b) =>
        part.listen(b, 'click', () => {
          if (submitted) return;
          const value = Number(b.dataset.cell),
            index = chosen.indexOf(value);
          if (pattern && index >= 0) {
            chosen.splice(index, 1);
            b.setAttribute('aria-pressed', 'false');
            b.classList.remove('is-active');
          } else if (pattern || chosen.length < q.sequence.length) {
            chosen.push(value);
            b.setAttribute('aria-pressed', 'true');
            b.classList.add('is-active');
          }
          stage.querySelector('#selectionStatus').textContent =
            `Selected: ${chosen.map((i) => (pattern ? i + 1 : String.fromCharCode(65 + i))).join(' → ') || 'none'}`;
          stage.querySelector('#submitVisual').disabled = pattern
            ? !chosen.length
            : chosen.length !== q.sequence.length;
          stage.querySelector('#clearVisual').disabled = !chosen.length;
        })
      );
      part.listen(stage.querySelector('#clearVisual'), 'click', () => {
        chosen.length = 0;
        buttons().forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        stage.querySelector('#selectionStatus').textContent = 'Selection cleared.';
        stage.querySelector('#submitVisual').disabled = true;
        stage.querySelector('#clearVisual').disabled = true;
        buttons()[0].focus({ preventScroll: true });
      });
      part.listen(stage.querySelector('#submitVisual'), 'click', () => {
        if (submitted) return;
        if (!pattern && chosen.length !== q.sequence.length) {
          stage.querySelector('#selectionStatus').textContent =
            `Choose ${q.sequence.length} blocks before submitting.`;
          return;
        }
        submitted = true;
        act(() => controller.answer(id, [...chosen], { activeMs: performance.now() - start }));
      });
      buttons()[0].focus({ preventScroll: true });
    };
    const exposePattern = () => {
      buttons().forEach((b, i) => b.classList.toggle('is-lit', q.sequence.includes(i)));
      const distract = () => {
        status.textContent = 'Ignore this distractor pattern';
        buttons().forEach((b, i) => b.classList.toggle('is-lit', q.distractor.includes(i)));
        part.timeout(recall, 800);
      };
      if (round.practice) {
        controls.innerHTML =
          '<button id="endExposure" class="btn btn-primary">I am ready to recall</button>';
        part.listen(controls.querySelector('button'), 'click', recall);
      } else part.timeout(distract, q.displayMs);
    };
    if (pattern) exposePattern();
    else {
      let i = 0;
      if (round.practice) {
        controls.innerHTML =
          '<button id="nextBlock" class="btn btn-primary">Show first block</button>';
        part.listen(controls.querySelector('button'), 'click', () => {
          buttons().forEach((b) => b.classList.remove('is-lit'));
          if (i === q.sequence.length) {
            recall();
            return;
          }
          buttons()[q.sequence[i++]].classList.add('is-lit');
          status.textContent = `Study block ${i} of ${q.sequence.length}`;
          controls.querySelector('button').textContent =
            i === q.sequence.length ? 'I am ready to recall' : 'Show next block';
        });
      }
      const flash = () => {
        if (i >= q.sequence.length) {
          recall();
          return;
        }
        const b = buttons()[q.sequence[i++]];
        b.classList.add('is-lit');
        part.timeout(() => {
          b.classList.remove('is-lit');
          part.timeout(flash, 250);
        }, q.displayMs);
      };
      if (!round.practice) part.timeout(flash, 400);
    }
    // Arrow keys move predictably within the grid; Space/Enter activate the cell.
    part.listen(stage, 'keydown', (event) => {
      const list = buttons(),
        index = list.indexOf(document.activeElement),
        width = pattern ? q.gridSize : 3;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: width, ArrowUp: -width }[event.key];
      if (index >= 0 && delta && !list[index].disabled) {
        event.preventDefault();
        list[(index + delta + list.length) % list.length].focus({ preventScroll: true });
      }
    });
  }
  act(async () => {
    if (current()?.status !== 'active') return;
    await controller.claim(id);
    if (
      !freshStart &&
      ['pattern-flash', 'corsi-span'].includes(current().rounds[current().roundIndex].game)
    )
      await controller.interrupt(id);
  }).then(heartbeat);
  return scope.dispose;
}
