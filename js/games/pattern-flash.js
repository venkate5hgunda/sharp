// Pattern Flash & Interference — Visual Working Memory under Retroactive Distraction
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { getDomainRatings, saveDomainRatings, calculateRatingDelta, getGameConfig, DOMAINS } from '../adaptive-engine.js';
import { logSessionRound } from '../analytics.js';

export function render(container, onComplete) {
  const ratings = getDomainRatings();
  const currentRating = ratings[DOMAINS.FOCUS] || 1000;
  const config = getGameConfig('pattern-flash', currentRating);

  container.innerHTML = `
    <div class="game-shell pattern-flash-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Visual Memory • Tier ${config.tier}</span>
          <h2 class="game-title">Pattern &amp; Interference</h2>
          <p class="game-subtitle">Memorize ${config.patternCount} patterns, resist confusing distractor flashes, and reconstruct the targets.</p>
        </div>
      </div>
      <div id="pfStage" class="game-body pattern-stage"></div>
    </div>
  `;

  const stage = container.querySelector('#pfStage');
  startSequence(stage, config, currentRating, onComplete);
}

function generatePattern(gridSize, cellCount) {
  const total = gridSize * gridSize;
  const indices = new Set();
  while (indices.size < cellCount) {
    indices.add(Math.floor(Math.random() * total));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function startSequence(stage, config, currentRating, onComplete) {
  const { gridSize, patternCount, distractorCount, displayMs } = config;
  const activeCells = gridSize === 3 ? 4 : gridSize === 4 ? 6 : 8;

  // Generate targets
  const targetPatterns = [];
  for (let i = 0; i < patternCount; i++) {
    targetPatterns.push(generatePattern(gridSize, activeCells));
  }

  // Generate distractors
  const distractors = [];
  for (let i = 0; i < distractorCount; i++) {
    distractors.push(generatePattern(gridSize, activeCells + (Math.random() > 0.5 ? 1 : -1)));
  }

  let currentTargetIndex = 0;

  function showNextTarget() {
    if (currentTargetIndex >= targetPatterns.length) {
      showInterferencePhase();
      return;
    }

    const pattern = targetPatterns[currentTargetIndex];
    stage.innerHTML = `
      <div class="pattern-flash-card">
        <div class="flash-indicator">
          <span>Target Pattern ${currentTargetIndex + 1} of ${patternCount}</span>
          <div class="timer-bar"><div class="timer-bar-fill" style="animation-duration: ${displayMs}ms"></div></div>
        </div>
        <div class="pattern-grid grid-${gridSize}">
          ${renderGridCells(gridSize, pattern)}
        </div>
        <p class="pattern-hint">Memorize this layout</p>
      </div>
    `;

    audio.flash();
    haptics.tap();

    setTimeout(() => {
      currentTargetIndex++;
      showNextTarget();
    }, displayMs + 300);
  }

  function showInterferencePhase() {
    let distractorIndex = 0;
    stage.innerHTML = `
      <div class="interference-warning-card">
        <span class="warning-icon">⚡</span>
        <h3>Cognitive Interference Phase</h3>
        <p>A sequence of <strong>irrelevant distractor patterns</strong> will flash rapidly. Resist their interference!</p>
      </div>
    `;

    audio.distract();
    setTimeout(showNextDistractor, 1400);

    function showNextDistractor() {
      if (distractorIndex >= distractors.length) {
        startRecallPhase();
        return;
      }

      const pattern = distractors[distractorIndex];
      stage.innerHTML = `
        <div class="pattern-flash-card is-distractor">
          <div class="distractor-banner">⚠️ IRRELEVANT DISTRACTOR #${distractorIndex + 1}</div>
          <div class="pattern-grid grid-${gridSize}">
            ${renderGridCells(gridSize, pattern, 'distractor-cell')}
          </div>
        </div>
      `;

      audio.distract();
      haptics.warning();

      distractorIndex++;
      setTimeout(showNextDistractor, 750);
    }
  }

  function startRecallPhase() {
    // Pick 1 or 2 target patterns to reconstruct
    const recallIndices = [0];
    if (patternCount > 2) recallIndices.push(Math.floor(patternCount / 2));
    if (patternCount >= 5) recallIndices.push(patternCount - 1);

    let recallStep = 0;
    const accuracies = [];
    const startTime = Date.now();

    function showRecallPrompt() {
      if (recallStep >= recallIndices.length) {
        finishGame();
        return;
      }

      const targetIdx = recallIndices[recallStep];
      const targetPattern = targetPatterns[targetIdx];
      const userSelected = new Set();

      stage.innerHTML = `
        <div class="reconstruction-container">
          <div class="reconstruction-header">
            <h3>🎨 Reconstruct Pattern #${targetIdx + 1}</h3>
            <p>Click or tap the cells below to redraw the <strong>original target pattern #${targetIdx + 1}</strong>.</p>
          </div>

          <div class="pattern-grid grid-${gridSize} interactive" id="drawGrid">
            ${Array.from({ length: gridSize * gridSize }, (_, i) => `
              <button class="cell interactive-cell" type="button" data-idx="${i}" aria-label="Cell ${i + 1}"></button>
            `).join('')}
          </div>

          <div class="reconstruction-controls">
            <button id="clearGridBtn" class="btn btn-outline" type="button">Clear</button>
            <button id="submitGridBtn" class="btn btn-primary" type="button">Submit Pattern</button>
          </div>
        </div>
      `;

      const gridEl = stage.querySelector('#drawGrid');
      const cells = gridEl.querySelectorAll('.interactive-cell');

      cells.forEach((cell) => {
        cell.addEventListener('click', () => {
          const idx = parseInt(cell.dataset.idx, 10);
          if (userSelected.has(idx)) {
            userSelected.delete(idx);
            cell.classList.remove('is-active');
            audio.pop();
          } else {
            userSelected.add(idx);
            cell.classList.add('is-active');
            audio.tap();
            haptics.tap();
          }
        });
      });

      stage.querySelector('#clearGridBtn').addEventListener('click', () => {
        userSelected.clear();
        cells.forEach((c) => c.classList.remove('is-active'));
        audio.pop();
      });

      stage.querySelector('#submitGridBtn').addEventListener('click', () => {
        // Calculate cell match
        const userArr = Array.from(userSelected);
        let truePositives = 0;
        let falsePositives = 0;

        userArr.forEach((idx) => {
          if (targetPattern.includes(idx)) truePositives++;
          else falsePositives++;
        });

        const targetCount = targetPattern.length;
        const precision = userArr.length > 0 ? truePositives / userArr.length : 0;
        const recall = truePositives / targetCount;
        const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        accuracies.push(f1);

        // Visual feedback
        cells.forEach((c) => {
          const idx = parseInt(c.dataset.idx, 10);
          const wasTarget = targetPattern.includes(idx);
          const wasPicked = userSelected.has(idx);

          if (wasTarget && wasPicked) c.classList.add('is-correct');
          else if (!wasTarget && wasPicked) c.classList.add('is-wrong');
          else if (wasTarget && !wasPicked) c.classList.add('is-missed');
        });

        if (f1 >= 0.75) audio.chime();
        else audio.buzz();

        setTimeout(() => {
          recallStep++;
          showRecallPrompt();
        }, 1200);
      });
    }

    function finishGame() {
      const totalTimeMs = Date.now() - startTime;
      const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      const deltaRes = calculateRatingDelta(currentRating, config.tier, avgAccuracy, totalTimeMs / accuracies.length, 12000);

      const ratings = getDomainRatings();
      ratings[DOMAINS.FOCUS] = deltaRes.newRating;
      saveDomainRatings(ratings);

      logSessionRound({
        gameId: 'pattern-flash',
        domain: DOMAINS.FOCUS,
        tier: config.tier,
        accuracy: avgAccuracy,
        questionsCount: recallIndices.length,
        correctCount: Math.round(avgAccuracy * recallIndices.length),
        averageLatencyMs: totalTimeMs / accuracies.length,
        ratingBefore: currentRating,
        ratingAfter: deltaRes.newRating
      });

      if (avgAccuracy >= 0.7) {
        audio.fanfare();
        burstConfetti();
        haptics.celebrate();
      }

      stage.innerHTML = `
        <div class="result-summary-card">
          <div class="result-icon">${avgAccuracy >= 0.7 ? '🌟' : '🎯'}</div>
          <h3>Interference Test Completed</h3>
          <p class="result-sub">You reconstructed ${recallIndices.length} target patterns under high cognitive interference.</p>

          <div class="stat-highlight-row">
            <div class="stat-box">
              <span class="stat-box-val">${Math.round(avgAccuracy * 100)}%</span>
              <span class="stat-box-lbl">Fidelity Score</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-val ${(deltaRes.delta >= 0 ? 'text-green' : 'text-amber')}">
                ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
              </span>
              <span class="stat-box-lbl">Focus Rating (${deltaRes.newRating})</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-val">${config.distractorCount}</span>
              <span class="stat-box-lbl">Distractors Resisted</span>
            </div>
          </div>

          <div class="summary-actions">
            <button id="pfFinishBtn" class="btn btn-primary btn-large" type="button">Done</button>
          </div>
        </div>
      `;

      stage.querySelector('#pfFinishBtn').addEventListener('click', () => {
        audio.tap();
        if (onComplete) onComplete();
      });
    }

    showRecallPrompt();
  }

  showNextTarget();
}

function renderGridCells(gridSize, pattern, extraClass = '') {
  const total = gridSize * gridSize;
  return Array.from({ length: total }, (_, i) => {
    const isLit = pattern.includes(i);
    return `<div class="cell ${isLit ? 'is-lit ' + extraClass : ''}"></div>`;
  }).join('');
}
