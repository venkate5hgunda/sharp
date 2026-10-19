import { createSessionScope, bindChoiceShortcuts } from '../core/session-scope.js';
import { escapeHTML } from '../content-validation.js';
// Deductive Syllogisms & Logic Reasoning Engine
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
  const currentRating = ratings[DOMAINS.LOGIC] || 1000;
  const config = getGameConfig('logic-deduction', currentRating);

  container.innerHTML = `
    <div class="game-shell logic-game-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Logic • Tier ${config.tier}</span>
          <h2 class="game-title">Deductive Syllogisms</h2>
          <p class="game-subtitle">Analyze premises and identify valid conclusions without falling for fallacies.</p>
        </div>
      </div>
      <div id="logicStage" class="game-body logic-stage"></div>
    </div>
  `;

  const stage = container.querySelector('#logicStage');
  runLogicSession(stage, config, currentRating, onComplete, scope);
  return scope.dispose;
}

function runLogicSession(stage, config, currentRating, onComplete, scope) {
  const selectedPuzzles = getQuestionsByDomain('logic', config.tier, 4);

  let qIndex = 0;
  let correctCount = 0;
  const latencies = [];

  function showPuzzle() {
    if (qIndex >= selectedPuzzles.length) {
      finishGame();
      return;
    }

    const puzzle = selectedPuzzles[qIndex];
    const qStartTime = Date.now();
    const shuffledOptions = [...puzzle.options].sort(() => Math.random() - 0.5);

    stage.innerHTML = `
      <div class="logic-puzzle-card">
        <div class="logic-card-meta">
          <span>Deduction ${qIndex + 1} of ${selectedPuzzles.length}</span>
          <span class="difficulty-tag">Tier ${puzzle.difficultyTier}</span>
        </div>

        <div class="premises-box">
          <div class="premises-label">GIVEN PREMISES:</div>
          <ul class="premises-list">
            ${puzzle.premises.map((p) => `<li>${escapeHTML(p)}</li>`).join('')}
          </ul>
        </div>

        <div class="logic-question-prompt">
          ${escapeHTML(puzzle.question)}
        </div>

        <div class="logic-options-grid" id="logicOpts">
          ${shuffledOptions.map((opt, i) => `
            <button class="btn logic-option-btn" type="button" data-val="${escapeHTML(opt)}">
              <span class="opt-key">${i + 1}</span>
              <span class="opt-text">${escapeHTML(opt)}</span>
            </button>
          `).join('')}
        </div>

        <div id="logicExplanation" class="logic-explanation" hidden></div>
      </div>
    `;

    const btns = stage.querySelectorAll('.logic-option-btn');
    const explanationEl = stage.querySelector('#logicExplanation');
    let answered = false;

    function handleChoice(val, btnEl) {
      if (answered) return;
      answered = true;
      removeKeyListener();

      const latency = Date.now() - qStartTime;
      latencies.push(latency);

      const isCorrect = val === puzzle.correctAnswer;
      recordQuestionAttempt(puzzle.id, isCorrect, latency);
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
          if (b.dataset.val === puzzle.correctAnswer) b.classList.add('is-correct');
        });
      }

      btns.forEach((b) => (b.disabled = true));
      explanationEl.innerHTML = `<strong>${isCorrect ? '✓ Correct Deduction' : '✗ Incorrect'}:</strong> ${escapeHTML(puzzle.explanation)}`;
      explanationEl.removeAttribute('hidden');

      scope.timeout(() => {
        qIndex++;
        showPuzzle();
      }, 2500);
    }

    btns.forEach((btn) => {
      scope.listen(btn, 'click', () => handleChoice(btn.dataset.val, btn));
    });

    const removeKeyListener = bindChoiceShortcuts(scope, btns, handleChoice);
  }

  const finishGame = scope.once(() => {
    const accuracy = correctCount / selectedPuzzles.length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const deltaRes = calculateRatingDelta(currentRating, config.tier, accuracy, avgLatency, 10000);

    const ratings = getDomainRatings();
    ratings[DOMAINS.LOGIC] = deltaRes.newRating;
    saveDomainRatings(ratings);

    logSessionRound({
      gameId: 'logic-deduction',
      domain: DOMAINS.LOGIC,
      tier: config.tier,
      accuracy,
      questionsCount: selectedPuzzles.length,
      correctCount,
      averageLatencyMs: avgLatency,
      ratingBefore: currentRating,
      ratingAfter: deltaRes.newRating
    });

    if (accuracy >= 0.75) {
      audio.fanfare();
      scope.addCleanup(burstConfetti());
      haptics.celebrate();
    }

    stage.innerHTML = `
      <div class="result-summary-card">
        <div class="result-icon">${accuracy >= 0.75 ? '💡' : '🔍'}</div>
        <h3>Deduction Session Complete</h3>
        <p class="result-sub">You solved <strong>${correctCount} of ${selectedPuzzles.length}</strong> logic challenges.</p>

        <div class="stat-highlight-row">
          <div class="stat-box">
            <span class="stat-box-val">${Math.round(accuracy * 100)}%</span>
            <span class="stat-box-lbl">Accuracy</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val ${(deltaRes.delta >= 0 ? 'text-green' : 'text-amber')}">
              ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
            </span>
            <span class="stat-box-lbl">Logic Rating (${deltaRes.newRating})</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val">${(avgLatency / 1000).toFixed(1)}s</span>
            <span class="stat-box-lbl">Avg Reasoning Time</span>
          </div>
        </div>

        <div class="summary-actions">
          <button id="logicDoneBtn" class="btn btn-primary btn-large" type="button">Done</button>
        </div>
      </div>
    `;

    scope.listen(stage.querySelector('#logicDoneBtn'), 'click', () => {
      audio.tap();
      if (onComplete) onComplete();
    });
  });

  showPuzzle();
}
