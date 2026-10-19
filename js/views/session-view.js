import { createSessionScope, bindChoiceShortcuts } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { projectRatings } from '../session/metrics.js';
import { CATALOG } from '../games/catalog.js';
import { audio } from '../audio.js';

const titleFor = (id) => CATALOG.find((g) => g.id === id)?.title || id;
export function renderSession(container, { repo, controller, id, navigate }) {
  const scope = createSessionScope(); let child = () => {}, paused = false, busy = false, error = '';
  let leaseTimer;
  scope.addCleanup(() => child());
  scope.addCleanup(() => { controller.release(id).catch(() => {}); });
  function current() { return repo.snapshot().sessions[id]; }
  async function act(action) {
    if (busy || !scope.active) return;
    busy = true; error = '';
    container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { await action(); } catch (cause) { error = cause.message; }
    busy = false; if (scope.active) draw();
  }
  async function heartbeat() {
    if (!scope.active) return;
    try { if (!document.hidden && !paused && current()?.status === 'active') await controller.heartbeat(id); }
    catch (cause) { paused = true; error = cause.message; if (scope.active) draw(); }
    leaseTimer = scope.timeout(heartbeat, 15000);
  }
  scope.listen(document, 'visibilitychange', () => {
    if (!document.hidden || paused || current()?.status !== 'active') return;
    paused = true; child();
    controller.interrupt(id).catch((cause) => { error = cause.message; }).finally(() => { if (scope.active) draw(); });
  });
  function draw() {
    child(); const part = createSessionScope(); child = part.dispose;
    const s = current();
    if (!s) { container.innerHTML = '<h1>Session unavailable</h1><a href="#/today">Return to Today</a>'; return; }
    const round = s.rounds[s.roundIndex];
    container.innerHTML = `<div class="game-nav-bar"><a href="#/today" class="btn btn-outline">Save &amp; exit</a>
      ${s.status === 'active' ? '<button id="pauseSession" class="btn btn-outline" type="button">Pause</button>' : ''}</div>
      <div class="view-header"><div><p class="text-muted">${s.kind === 'workout' ? `Workout · Exercise ${s.roundIndex + 1} of ${s.rounds.length}` : 'Exercise session'}</p>
      <h1 class="view-title">${h(titleFor(round.game))}</h1><p>${round.practice ? 'Untimed practice · ratings unchanged' : 'Local progress · saved after each answer'}</p></div></div>
      <p id="sessionError" class="question-feedback" role="alert" ${error ? '' : 'hidden'}>${h(error)}</p><div id="sessionStage"></div>`;
    part.listen(container.querySelector('#pauseSession') || new EventTarget(), 'click', () => act(async () => { await controller.interrupt(id); paused = true; }));
    const stage = container.querySelector('#sessionStage');
    if (paused || error) {
      stage.innerHTML = `<div class="workout-card"><h2>Session paused</h2><p>Your completed answers are saved. Timed memory exposure restarts on resume.</p>
        <button id="resumeSession" class="btn btn-primary">Resume session</button>
        <button id="takeoverSession" class="btn btn-outline">Take over from another tab</button></div>`;
      part.listen(stage.querySelector('#resumeSession'), 'click', () => act(async () => { await controller.claim(id); paused = false; }));
      part.listen(stage.querySelector('#takeoverSession'), 'click', () => act(async () => { await controller.claim(id, true); paused = false; }));
      return;
    }
    if (round.phase === 'intro') {
      const visual = ['pattern-flash', 'corsi-span'].includes(round.game);
      const example = round.game === 'pattern-flash' ? 'Watch the lit cells, ignore the distractor, then select the original cells. Selecting an extra cell reduces the fidelity score.'
        : round.game === 'corsi-span' ? 'Watch the blocks, then repeat their exact order. Example: A → C → B means select A, then C, then B. This is forward recall.'
        : round.game.includes('math') ? 'Example: 12 + 7 = 19. Select one answer, read the feedback, then choose Next.'
        : round.game === 'logic-deduction' ? 'Use only the premises. Example: all A are B and all B are C implies all A are C. Do not assume a category has members unless stated.'
        : 'Read the passage, then choose the answer supported by its evidence. Outside knowledge is unnecessary.';
      stage.innerHTML = `<div class="workout-card"><h2>How to practise</h2><p>${example}</p>
        <p>${visual && !round.practice ? 'Exposure is timed. Leaving this tab pauses the task. Use untimed practice for a self-paced alternative.' : 'Take your time. Use the buttons or number keys 1–4 for choices.'}</p>
        ${visual ? '<p>This is a visual exercise. For a reading-based alternative, choose Logic from Exercises; its score is separate.</p>' : ''}
        <button id="beginRound" class="btn btn-primary btn-large">Begin exercise</button></div>`;
      part.listen(stage.querySelector('#beginRound'), 'click', () => act(() => controller.begin(id)));
    } else if (round.phase === 'summary') {
      const state = repo.snapshot(), result = state.rounds[`${id}:${s.roundIndex}`], transition = projectRatings(state).transitions[result.id];
      stage.innerHTML = `<div class="result-summary-card"><h2 tabindex="-1">${s.status === 'completed' ? 'Session complete' : 'Exercise complete'}</h2>
        <p>${result.count} responses · ${Math.round(result.score / result.count * 100)}% ${round.game === 'pattern-flash' ? 'pattern fidelity' : 'accuracy'}.</p>
        <p>${transition ? `Rating ${transition.before} → ${transition.after} (${transition.delta >= 0 ? '+' : ''}${transition.delta})` : 'Practice recorded. Your rating is unchanged.'}</p>
        <p>Saved on this device.</p><button id="roundDone" class="btn btn-primary">${s.status === 'completed' ? 'View progress' : 'Next exercise'}</button></div>`;
      stage.querySelector('h2').focus();
      part.listen(stage.querySelector('#roundDone'), 'click', () => s.status === 'completed' ? navigate('progress') : act(() => controller.nextRound(id)));
    } else if (round.phase === 'feedback') renderFeedback(stage, round, s, part);
    else if (['pattern-flash', 'corsi-span'].includes(round.game)) renderVisual(stage, round, s, part);
    else renderQuestion(stage, round, s, part);
  }
  function renderQuestion(stage, round, s, part) {
    const q = round.items[round.position];
    let started = performance.now(), readingMs = 0;
    stage.innerHTML = `<div class="math-question-card"><p>Question ${round.position + 1} of ${round.items.length} · Tier ${q.tier} · ${h(q.skill.replaceAll('_', ' '))}</p>
      ${q.passage ? `<h2>${h(q.title)}</h2><div class="comprehension-passage">${h(q.passage)}</div><button id="readingDone" class="btn btn-primary">Ready for the question</button>` : ''}
      ${q.premises?.length ? `<ul class="premises-list">${q.premises.map((p) => `<li>${h(p)}</li>`).join('')}</ul>` : ''}
      <div id="answerPhase" ${q.passage ? 'hidden' : ''}><h2 id="questionPrompt">${h(q.question || q.prompt)}</h2>
      <div class="logic-options-grid" role="group" aria-labelledby="questionPrompt">${q.options.map((o, i) => `<button type="button" class="btn logic-option-btn" data-val="${h(o.id)}"><span class="opt-key">${i + 1}</span><span>${h(o.text)}</span></button>`).join('')}</div></div></div>`;
    const btns = stage.querySelectorAll('[data-val]');
    let submitted = false, shortcut = () => {};
    const choose = (value) => {
      if (submitted || stage.querySelector('#answerPhase').hidden) return; submitted = true; shortcut();
      act(() => controller.answer(id, value, { activeMs: performance.now() - started, hiddenMs: 0, readingMs }, { roundIndex: s.roundIndex, position: round.position }));
    };
    btns.forEach((button) => part.listen(button, 'click', () => choose(button.dataset.val)));
    const enable = () => { shortcut = bindChoiceShortcuts(part, btns, choose); btns[0]?.focus(); };
    if (q.passage) part.listen(stage.querySelector('#readingDone'), 'click', () => {
      readingMs = performance.now() - started; started = performance.now(); stage.querySelector('#readingDone').hidden = true;
      stage.querySelector('#answerPhase').hidden = false; enable();
    }); else enable();
  }
  function renderFeedback(stage, round, s, part) {
    const q = round.items[round.position], attempt = repo.snapshot().attempts[`${id}:${s.roundIndex}:${round.position}`];
    const correct = q.options?.find((o) => o.id === q.correctOptionId)?.text;
    stage.innerHTML = `<div class="workout-card"><h2 tabindex="-1">${attempt.score === 1 ? 'Correct' : round.game === 'pattern-flash' ? `${Math.round(attempt.score * 100)}% fidelity` : 'Keep practising'}</h2>
      <div class="question-feedback" role="status"><p>${h(q.explanation || (round.game === 'corsi-span' ? `Sequence: ${q.sequence.map((n) => String.fromCharCode(65 + n)).join(' → ')}` : `Target cells: ${q.sequence.map((n) => n + 1).join(', ')}`))}</p>
      ${correct ? `<p>Correct answer: <strong>${h(correct)}</strong></p>` : ''}</div>
      <button id="nextQuestion" class="btn btn-primary">${round.position === round.items.length - 1 ? 'View results' : 'Next question'}</button></div>`;
    stage.querySelector('#nextQuestion').focus();
    part.listen(stage.querySelector('#nextQuestion'), 'click', () => act(() => controller.next(id)));
    part.listen(stage, 'keydown', (event) => { if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault(); });
  }
  function renderVisual(stage, round, s, part) {
    const q = round.items[round.position], pattern = round.game === 'pattern-flash', chosen = []; let submitted = false;
    const buttons = () => [...stage.querySelectorAll('[data-cell]')];
    const grid = () => `<div class="${pattern ? `pattern-grid grid-${q.gridSize}` : 'pattern-grid grid-3'}" role="group" aria-label="${pattern ? 'Pattern' : 'Sequence'} cells">${Array.from({ length: q.size }, (_, i) => `<button class="cell interactive-cell" data-cell="${i}" aria-label="${pattern ? `Cell ${i + 1}` : `Block ${String.fromCharCode(65 + i)}`}" aria-pressed="false" disabled>${pattern ? i + 1 : String.fromCharCode(65 + i)}</button>`).join('')}</div>`;
    stage.innerHTML = `<div class="workout-card"><p>Trial ${round.position + 1} of ${round.items.length}</p><h2 id="visualStatus">Watch ${pattern ? 'the pattern' : 'the sequence'}</h2>${grid()}<div id="visualControls"></div></div>`;
    const status = stage.querySelector('#visualStatus'), controls = stage.querySelector('#visualControls');
    const recall = () => {
      buttons().forEach((b) => { b.classList.remove('is-lit'); b.disabled = false; });
      status.textContent = pattern ? 'Select the original target cells' : `Repeat ${q.sequence.length} blocks in order`;
      controls.innerHTML = '<p id="selectionStatus" role="status">No cells selected.</p><button id="clearVisual" class="btn btn-outline">Clear selection</button><button id="submitVisual" class="btn btn-primary">Submit response</button>';
      const start = performance.now();
      buttons().forEach((b) => part.listen(b, 'click', () => {
        if (submitted) return;
        const value = Number(b.dataset.cell), index = chosen.indexOf(value);
        if (pattern && index >= 0) { chosen.splice(index, 1); b.setAttribute('aria-pressed', 'false'); b.classList.remove('is-active'); }
        else if (pattern || chosen.length < q.sequence.length) { chosen.push(value); b.setAttribute('aria-pressed', 'true'); b.classList.add('is-active'); }
        stage.querySelector('#selectionStatus').textContent = `Selected: ${chosen.map((i) => pattern ? i + 1 : String.fromCharCode(65 + i)).join(' → ') || 'none'}`;
      }));
      part.listen(stage.querySelector('#clearVisual'), 'click', () => { chosen.length = 0; buttons().forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); }); stage.querySelector('#selectionStatus').textContent = 'Selection cleared.'; });
      part.listen(stage.querySelector('#submitVisual'), 'click', () => {
        if (submitted) return;
        if (!pattern && chosen.length !== q.sequence.length) { stage.querySelector('#selectionStatus').textContent = `Choose ${q.sequence.length} blocks before submitting.`; return; }
        submitted = true; act(() => controller.answer(id, [...chosen], { activeMs: performance.now() - start }));
      });
      buttons()[0].focus();
    };
    const exposePattern = () => {
      buttons().forEach((b, i) => b.classList.toggle('is-lit', q.sequence.includes(i)));
      const distract = () => {
        status.textContent = 'Ignore this distractor pattern';
        buttons().forEach((b, i) => b.classList.toggle('is-lit', q.distractor.includes(i)));
        part.timeout(recall, 800);
      };
      if (round.practice) { controls.innerHTML = '<button id="endExposure" class="btn btn-primary">I am ready to recall</button>'; part.listen(controls.querySelector('button'), 'click', recall); }
      else part.timeout(distract, q.displayMs);
    };
    if (pattern) exposePattern();
    else {
      let i = 0;
      const flash = () => {
        if (i >= q.sequence.length) { recall(); return; }
        const b = buttons()[q.sequence[i++]]; b.classList.add('is-lit');
        part.timeout(() => { b.classList.remove('is-lit'); part.timeout(flash, 250); }, round.practice ? 1500 : q.displayMs);
      };
      part.timeout(flash, 400);
    }
    // Arrow keys move predictably within the grid; Space/Enter activate the cell.
    part.listen(stage, 'keydown', (event) => {
      const list = buttons(), index = list.indexOf(document.activeElement), width = pattern ? q.gridSize : 3;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: width, ArrowUp: -width }[event.key];
      if (index >= 0 && delta && !list[index].disabled) { event.preventDefault(); list[(index + delta + list.length) % list.length].focus(); }
    });
  }
  act(async () => {
    if (current()?.status !== 'active') return;
    await controller.claim(id); await controller.interrupt(id);
  }).then(heartbeat);
  return scope.dispose;
}
