// Spatial Corsi Span — Visuospatial Working Memory Engine
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { getDomainRatings, saveDomainRatings, calculateRatingDelta, getGameConfig, DOMAINS } from '../adaptive-engine.js';
import { logSessionRound } from '../analytics.js';

export function render(container, onComplete) {
  const ratings = getDomainRatings();
  const currentRating = ratings[DOMAINS.FOCUS] || 1000;
  const config = getGameConfig('corsi-span', currentRating);

  container.innerHTML = `
    <div class="game-shell corsi-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Working Memory • Tier ${config.tier}</span>
          <h2 class="game-title">Spatial Corsi Span</h2>
          <p class="game-subtitle">Observe the sequence of illuminated blocks, then repeat in exact order.</p>
        </div>
      </div>
      <div id="corsiStage" class="game-body corsi-stage"></div>
    </div>
  `;

  const stage = container.querySelector('#corsiStage');
  runCorsiSession(stage, config, currentRating, onComplete);
}

function runCorsiSession(stage, config, currentRating, onComplete) {
  const blockCount = config.blockSize; // 7 or 9
  let currentSpan = config.startSpan; // typically 3 or 4
  let trial = 1;
  const maxTrials = 5;
  let successCount = 0;
  const latencies = [];

  // Generate blocks layout with scattered coordinates
  const blocks = Array.from({ length: blockCount }, (_, i) => ({
    id: i,
    label: String.fromCharCode(65 + i)
  }));

  function startTrial() {
    if (trial > maxTrials) {
      finishGame();
      return;
    }

    // Generate random sequence without immediate consecutive duplicates
    const sequence = [];
    while (sequence.length < currentSpan) {
      const next = Math.floor(Math.random() * blockCount);
      if (sequence.length === 0 || sequence[sequence.length - 1] !== next) {
        sequence.push(next);
      }
    }

    stage.innerHTML = `
      <div class="corsi-board-card">
        <div class="corsi-meta-row">
          <span>Trial ${trial} of ${maxTrials}</span>
          <span class="difficulty-tag">Span Length: ${currentSpan}</span>
        </div>
        <div id="corsiStatus" class="corsi-status-text">Watch the sequence...</div>

        <div class="corsi-board" id="corsiBoard">
          ${blocks.map((b) => `
            <button class="corsi-block" type="button" data-id="${b.id}" disabled>
              <span>${b.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const board = stage.querySelector('#corsiBoard');
    const blockEls = board.querySelectorAll('.corsi-block');
    const statusEl = stage.querySelector('#corsiStatus');

    // Flash sequence
    let flashIdx = 0;
    setTimeout(flashNext, 600);

    function flashNext() {
      if (flashIdx >= sequence.length) {
        enableInput();
        return;
      }

      const targetId = sequence[flashIdx];
      const targetEl = board.querySelector(`[data-id="${targetId}"]`);

      if (targetEl) {
        targetEl.classList.add('is-lit');
        audio.scheduleTone(360 + targetId * 60, 0.18, 'triangle', 0.25);
        haptics.tap();

        setTimeout(() => {
          targetEl.classList.remove('is-lit');
          flashIdx++;
          setTimeout(flashNext, 200);
        }, config.flashDurationMs);
      }
    }

    function enableInput() {
      statusEl.textContent = `Your turn! Tap the ${currentSpan} blocks in order.`;
      statusEl.classList.add('is-active');

      const userInputs = [];
      const trialStartTime = Date.now();

      blockEls.forEach((btn) => {
        btn.disabled = false;
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id, 10);
          userInputs.push(id);

          btn.classList.add('is-active-tap');
          audio.scheduleTone(360 + id * 60, 0.12, 'sine', 0.2);
          haptics.tap();

          setTimeout(() => btn.classList.remove('is-active-tap'), 200);

          const curPos = userInputs.length - 1;
          if (userInputs[curPos] !== sequence[curPos]) {
            // Immediate error
            audio.buzz();
            haptics.warning();
            statusEl.textContent = '✗ Sequence mismatch!';
            statusEl.classList.add('is-error');
            blockEls.forEach((b) => (b.disabled = true));
            latencies.push(Date.now() - trialStartTime);

            setTimeout(() => {
              trial++;
              // Retain or reduce span slightly on failure
              if (currentSpan > 3) currentSpan--;
              startTrial();
            }, 1200);
          } else if (userInputs.length === sequence.length) {
            // Completed trial successfully!
            successCount++;
            audio.chime();
            haptics.success();
            statusEl.textContent = '✓ Perfect span recall!';
            statusEl.classList.add('is-success');
            blockEls.forEach((b) => (b.disabled = true));
            latencies.push(Date.now() - trialStartTime);

            setTimeout(() => {
              trial++;
              // Increase span on success
              currentSpan++;
              startTrial();
            }, 1200);
          }
        });
      });
    }
  }

  function finishGame() {
    const accuracy = successCount / maxTrials;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const deltaRes = calculateRatingDelta(currentRating, config.tier, accuracy, avgLatency, 6000);

    const ratings = getDomainRatings();
    ratings[DOMAINS.FOCUS] = deltaRes.newRating;
    saveDomainRatings(ratings);

    logSessionRound({
      gameId: 'corsi-span',
      domain: DOMAINS.FOCUS,
      tier: config.tier,
      accuracy,
      questionsCount: maxTrials,
      correctCount: successCount,
      averageLatencyMs: avgLatency,
      ratingBefore: currentRating,
      ratingAfter: deltaRes.newRating
    });

    if (accuracy >= 0.6) {
      audio.fanfare();
      burstConfetti();
      haptics.celebrate();
    }

    stage.innerHTML = `
      <div class="result-summary-card">
        <div class="result-icon">${accuracy >= 0.6 ? '🧠' : '🎯'}</div>
        <h3>Working Memory Assessment Complete</h3>
        <p class="result-sub">You successfully recalled <strong>${successCount} of ${maxTrials}</strong> spatial sequences.</p>

        <div class="stat-highlight-row">
          <div class="stat-box">
            <span class="stat-box-val">${currentSpan} blocks</span>
            <span class="stat-box-lbl">Peak Memory Span</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val ${(deltaRes.delta >= 0 ? 'text-green' : 'text-amber')}">
              ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
            </span>
            <span class="stat-box-lbl">Focus Rating (${deltaRes.newRating})</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val">${Math.round(accuracy * 100)}%</span>
            <span class="stat-box-lbl">Accuracy</span>
          </div>
        </div>

        <div class="summary-actions">
          <button id="corsiDoneBtn" class="btn btn-primary btn-large" type="button">Done</button>
        </div>
      </div>
    `;

    stage.querySelector('#corsiDoneBtn').addEventListener('click', () => {
      audio.tap();
      if (onComplete) onComplete();
    });
  }

  startTrial();
}
