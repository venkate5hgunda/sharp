import { createSessionScope, bindChoiceShortcuts } from '../core/session-scope.js';
import { escapeHTML } from '../content-validation.js';
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { getDomainRatings, saveDomainRatings, calculateRatingDelta, getGameConfig, DOMAINS } from '../adaptive-engine.js';
import { logSessionRound } from '../analytics.js';
import { getQuestionsByDomain, recordQuestionAttempt } from '../../data/questions-db.js';

export function render(container, onComplete) {
  const scope = createSessionScope();
  onComplete = scope.once(onComplete || (() => {}));
  const ratings = getDomainRatings();
  const currentRating = ratings[DOMAINS.COMPREHENSION] || 1000;
  const config = getGameConfig('comprehension-inference', currentRating);

  container.innerHTML = `
    <div class="game-shell comprehension-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Comprehension • Tier ${config.tier}</span>
          <h2 class="game-title">Speed Inference</h2>
          <p class="game-subtitle">Read concise analytical passages and deduce logical implications under focus.</p>
        </div>
      </div>
      <div id="compStage" class="game-body comprehension-stage"></div>
    </div>
  `;

  const stage = container.querySelector('#compStage');
  runComprehensionSession(stage, config, currentRating, onComplete, scope);
  return scope.dispose;
}

function runComprehensionSession(stage, config, currentRating, onComplete, scope) {
  const selected = getQuestionsByDomain('comprehension', config.tier, 3);

  let qIndex = 0;
  let correctCount = 0;
  const latencies = [];

  function showQuestion() {
    if (qIndex >= selected.length) {
      finishGame();
      return;
    }

    const item = selected[qIndex];
    const qStartTime = Date.now();
    const shuffledOptions = [...item.options].sort(() => Math.random() - 0.5);

    stage.innerHTML = `
      <div class="comprehension-card">
        <div class="comp-card-meta">
          <span>Passage ${qIndex + 1} of ${selected.length}</span>
          <span class="difficulty-tag">${escapeHTML(item.title)}</span>
        </div>

        <div class="passage-box">
          <p class="passage-text">${escapeHTML(item.passage)}</p>
        </div>

        <div class="comp-question-prompt">
          ${escapeHTML(item.question)}
        </div>

        <div class="comp-options-grid" id="compOpts">
          ${shuffledOptions.map((opt, i) => `
            <button class="btn comp-option-btn" type="button" data-val="${escapeHTML(opt)}">
              <span class="opt-key">${i + 1}</span>
              <span class="opt-text">${escapeHTML(opt)}</span>
            </button>
          `).join('')}
        </div>

        <div id="compExplanation" class="comp-explanation" hidden></div>
      </div>
    `;

    const btns = stage.querySelectorAll('.comp-option-btn');
    const explEl = stage.querySelector('#compExplanation');
    let answered = false;

    function handleChoice(val, btnEl) {
      if (answered) return;
      answered = true;
      removeKeyListener();

      const latency = Date.now() - qStartTime;
      latencies.push(latency);

      const isCorrect = val === item.correctAnswer;
      recordQuestionAttempt(item.id, isCorrect, latency);
      if (isCorrect) {
        correctCount++;
        btnEl.classList.add('is-correct');
        audio.chime();
        haptics.success();
      } else {
        btnEl.classList.add('is-wrong');
        audio.buzz();
        haptics.warning();
        btns.forEach((b) => {
          if (b.dataset.val === item.correctAnswer) b.classList.add('is-correct');
        });
      }

      btns.forEach((b) => (b.disabled = true));
      explEl.innerHTML = `<strong>${isCorrect ? '✓ Valid Inference' : '✗ Incorrect'}:</strong> ${escapeHTML(item.explanation)}`;
      explEl.removeAttribute('hidden');

      scope.timeout(() => {
        qIndex++;
        showQuestion();
      }, 2500);
    }

    btns.forEach((btn) => {
      scope.listen(btn, 'click', () => handleChoice(btn.dataset.val, btn));
    });

    const removeKeyListener = bindChoiceShortcuts(scope, btns, handleChoice);
  }

  const finishGame = scope.once(() => {
    const accuracy = correctCount / selected.length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const deltaRes = calculateRatingDelta(currentRating, config.tier, accuracy, avgLatency, 18000);

    const ratings = getDomainRatings();
    ratings[DOMAINS.COMPREHENSION] = deltaRes.newRating;
    saveDomainRatings(ratings);

    logSessionRound({
      gameId: 'comprehension-inference',
      domain: DOMAINS.COMPREHENSION,
      tier: config.tier,
      accuracy,
      questionsCount: selected.length,
      correctCount,
      averageLatencyMs: avgLatency,
      ratingBefore: currentRating,
      ratingAfter: deltaRes.newRating
    });

    if (accuracy >= 0.7) {
      audio.fanfare();
      scope.addCleanup(burstConfetti());
      haptics.celebrate();
    }

    stage.innerHTML = `
      <div class="result-summary-card">
        <div class="result-icon">${accuracy >= 0.7 ? '📖' : '📝'}</div>
        <h3>Inference Assessment Complete</h3>
        <p class="result-sub">You correctly analyzed <strong>${correctCount} of ${selected.length}</strong> analytical passages.</p>

        <div class="stat-highlight-row">
          <div class="stat-box">
            <span class="stat-box-val">${Math.round(accuracy * 100)}%</span>
            <span class="stat-box-lbl">Comprehension</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val ${(deltaRes.delta >= 0 ? 'text-green' : 'text-amber')}">
              ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
            </span>
            <span class="stat-box-lbl">Verbal Rating (${deltaRes.newRating})</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val">${(avgLatency / 1000).toFixed(1)}s</span>
            <span class="stat-box-lbl">Reading &amp; Deduction</span>
          </div>
        </div>

        <div class="summary-actions">
          <button id="compDoneBtn" class="btn btn-primary btn-large" type="button">Done</button>
        </div>
      </div>
    `;

    scope.listen(stage.querySelector('#compDoneBtn'), 'click', () => {
      audio.tap();
      if (onComplete) onComplete();
    });
  });

  showQuestion();
}
