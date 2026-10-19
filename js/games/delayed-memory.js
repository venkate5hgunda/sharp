import { createSessionScope } from '../core/session-scope.js';
import { createId } from '../core/identity.js';
import { escapeHTML } from '../content-validation.js';
// Time-Capsule Delayed Memory — Morning Study & Evening Recall Protocol
import { loadJSON, saveJSON, KEYS } from '../storage.js';
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { getDomainRatings, saveDomainRatings, calculateRatingDelta, getGameConfig, DOMAINS } from '../adaptive-engine.js';
import { logSessionRound } from '../analytics.js';
import { getMemoryCluster } from '../../data/questions-db.js';

const WORD_BANK = [
  { word: 'Sapphire', category: 'Gems', icon: '💎', cue: 'Blue precious gemstone' },
  { word: 'Falcon', category: 'Birds', icon: '🦅', cue: 'Fast predatory raptor' },
  { word: 'Violin', category: 'Music', icon: '🎻', cue: 'Four-string wooden instrument' },
  { word: 'Telescope', category: 'Science', icon: '🔭', cue: 'Optical star gazer' },
  { word: 'Compass', category: 'Navigation', icon: '🧭', cue: 'Magnetic cardinal pointer' },
  { word: 'Canyon', category: 'Geography', icon: '🏜️', cue: 'Deep carved river ravine' },
  { word: 'Orchid', category: 'Flora', icon: '🌺', cue: 'Exotic fragrant blossom' },
  { word: 'Lantern', category: 'Tools', icon: '🏮', cue: 'Portable illuminated light' },
  { word: 'Anchor', category: 'Maritime', icon: '⚓', cue: 'Heavy seabed mooring iron' },
  { word: 'Glacier', category: 'Nature', icon: '🧊', cue: 'Slow-moving mountain ice' },
  { word: 'Pyramid', category: 'History', icon: '🏛️', cue: 'Ancient monumental stone tomb' },
  { word: 'Harbor', category: 'Maritime', icon: '⛵', cue: 'Sheltered coastal haven' },
  { word: 'Volcano', category: 'Geology', icon: '🌋', cue: 'Molten magma crater' },
  { word: 'Emerald', category: 'Gems', icon: '💚', cue: 'Vibrant green beryl jewel' },
  { word: 'Obsidian', category: 'Minerals', icon: '🖤', cue: 'Volcanic vitreous black glass' }
];

const DISTRACTOR_BANK = [
  { word: 'Ruby', category: 'Gems', icon: '❤️' },
  { word: 'Hawk', category: 'Birds', icon: '🦜' },
  { word: 'Cello', category: 'Music', icon: '🪕' },
  { word: 'Microscope', category: 'Science', icon: '🔬' },
  { word: 'Sundial', category: 'Navigation', icon: '⏱️' },
  { word: 'Plateau', category: 'Geography', icon: '🏔️' },
  { word: 'Tulip', category: 'Flora', icon: '🌷' },
  { word: 'Torch', category: 'Tools', icon: '🔦' },
  { word: 'Rudder', category: 'Maritime', icon: '🚢' },
  { word: 'Avalanche', category: 'Nature', icon: '❄️' },
  { word: 'Obelisk', category: 'History', icon: '🗿' },
  { word: 'Lighthouse', category: 'Maritime', icon: '🗼' }
];

export function render(container, onComplete) {
  const scope = createSessionScope();
  onComplete = scope.once(onComplete || (() => {}));
  const ratings = getDomainRatings();
  const currentRating = ratings[DOMAINS.MEMORY] || 1000;
  const config = getGameConfig('delayed-memory', currentRating);
  const stored = loadJSON(KEYS.DELAYED_MEMORY, null);

  container.innerHTML = `
    <div class="game-shell delayed-memory-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Memory • Tier ${config.tier}</span>
          <h2 class="game-title">Time-Capsule Recall</h2>
          <p class="game-subtitle">Study items now, let time create natural interference, then test retention.</p>
        </div>
      </div>
      <div id="dmContent" class="game-body"></div>
    </div>
  `;

  const contentEl = container.querySelector('#dmContent');

  if (stored && stored.status === 'committed') {
    renderWaitingOrRecallView(contentEl, stored, config, currentRating, onComplete, scope);
  } else {
    renderStudyView(contentEl, config, currentRating, onComplete, scope);
  }
  return scope.dispose;
}

function renderStudyView(container, config, currentRating, onComplete, scope) {
  const cluster = getMemoryCluster(config.tier);
  let targetWords = [];

  if (cluster && cluster.targetItems && cluster.targetItems.length >= config.itemCount) {
    targetWords = cluster.targetItems.slice(0, config.itemCount);
  } else {
    const shuffledWords = [...WORD_BANK].sort(() => Math.random() - 0.5);
    targetWords = shuffledWords.slice(0, config.itemCount);
    if (config.includesNumbers) {
      const code = Math.floor(100 + Math.random() * 900);
      targetWords.push({ word: `Code ${code}`, category: 'Security Code', icon: '🔐', cue: `3-digit passkey: ${code}` });
    }
  }

  container.innerHTML = `
    <div class="study-card-container">
      <div class="study-instructions-card">
        <h3>🌅 Phase 1: Study &amp; Commit</h3>
        <p>Carefully study the <strong>${targetWords.length} items</strong> below. Form mental pictures connecting their cues. Once committed, you will be prompted to recall them after a delay period.</p>
      </div>

      <div class="study-items-grid">
        ${targetWords.map((item, idx) => `
          <div class="study-item-card" style="animation-delay: ${idx * 60}ms">
            <span class="item-icon">${escapeHTML(item.icon)}</span>
            <div class="item-text">
              <span class="item-category">${escapeHTML(item.category)}</span>
              <strong class="item-word">${escapeHTML(item.word)}</strong>
              <small class="item-cue">${escapeHTML(item.cue)}</small>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="study-actions">
        <button id="commitBtn" class="btn btn-primary btn-large" type="button">
          ✓ I Have Committed These to Memory
        </button>
        <button id="quickTestBtn" class="btn btn-secondary" type="button">
          ⚡ Practice with 3-Minute Quick Delay
        </button>
      </div>
    </div>
  `;

  audio.flash();

  scope.listen(container.querySelector('#commitBtn'), 'click', () => {
    audio.tap();
    const readyAt = Date.now() + 6 * 3600 * 1000; // 6 hours
    saveSession(targetWords, 'daily_morning', readyAt);
  });

  scope.listen(container.querySelector('#quickTestBtn'), 'click', () => {
    audio.tap();
    const readyAt = Date.now() + 180 * 1000; // 3 minutes
    saveSession(targetWords, 'quick_timer', readyAt);
  });

  function saveSession(items, type, readyAt) {
    const session = {
      id: createId('dm'),
      status: 'committed',
      type,
      tier: config.tier,
      items,
      createdAt: Date.now(),
      readyAt
    };
    saveJSON(KEYS.DELAYED_MEMORY, session);
    renderWaitingOrRecallView(container, session, config, currentRating, onComplete, scope);
  }
}

function renderWaitingOrRecallView(container, session, config, currentRating, onComplete, scope) {
  const now = Date.now();
  const isReady = now >= session.readyAt;

  if (!isReady) {
    const diffSec = Math.max(0, Math.round((session.readyAt - now) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);

    container.innerHTML = `
      <div class="memory-waiting-card">
        <div class="waiting-icon">⏳</div>
        <h3>Memory Consolidation in Progress</h3>
        <p>You committed <strong>${session.items.length} items</strong> at ${new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
        <div class="time-remaining-pill">
          ${hours > 0 ? `${hours}h ` : ''}${mins}m remaining until recall test
        </div>
        <p class="waiting-tip">💡 Tip: Avoid writing them down. Natural mental decay and interference are part of the training!</p>
        
        <div class="waiting-actions">
          <button id="testNowBtn" class="btn btn-primary" type="button">
            Test Recall Early Now
          </button>
          <button id="resetSessionBtn" class="btn btn-outline" type="button">
            Start Fresh Study Set
          </button>
        </div>
      </div>
    `;

    scope.listen(container.querySelector('#testNowBtn'), 'click', () => {
      audio.tap();
      renderRecallTest(container, session, config, currentRating, onComplete, scope);
    });

    scope.listen(container.querySelector('#resetSessionBtn'), 'click', () => {
      audio.pop();
      saveJSON(KEYS.DELAYED_MEMORY, null);
      renderStudyView(container, config, currentRating, onComplete, scope);
    });
  } else {
    renderRecallTest(container, session, config, currentRating, onComplete, scope);
  }
}

function renderRecallTest(container, session, config, currentRating, onComplete, scope) {
  const targetItems = session.items;
  const targetWords = targetItems.map((i) => i.word.toLowerCase());

  // Prepare recognition distractors
  const distractors = [...DISTRACTOR_BANK]
    .sort(() => Math.random() - 0.5)
    .slice(0, targetItems.length * 2);

  const recognitionPool = [...targetItems, ...distractors]
    .sort(() => Math.random() - 0.5);

  const startTime = Date.now();

  container.innerHTML = `
    <div class="recall-test-container">
      <div class="recall-header">
        <h3>🌙 Phase 2: Recognition &amp; Retrieval</h3>
        <p>Select all <strong>${targetItems.length} items</strong> you committed earlier. Beware of convincing distractor foils!</p>
      </div>

      <div class="recognition-grid" id="recogGrid">
        ${recognitionPool.map((item) => `
          <button class="recognition-chip" type="button" data-word="${escapeHTML(item.word)}" data-is-target="${targetWords.includes(item.word.toLowerCase())}">
            <span class="chip-icon">${escapeHTML(item.icon)}</span>
            <span class="chip-label">${escapeHTML(item.word)}</span>
          </button>
        `).join('')}
      </div>

      <div class="recall-submit-row">
        <span id="selectedCount" class="selected-counter">0 / ${targetItems.length} selected</span>
        <button id="submitRecallBtn" class="btn btn-primary" type="button" disabled>
          Submit Recall Evaluation
        </button>
      </div>
    </div>
  `;

  const selectedWords = new Set();
  const chips = container.querySelectorAll('.recognition-chip');
  const countEl = container.querySelector('#selectedCount');
  const submitBtn = container.querySelector('#submitRecallBtn');
  let submitted = false;

  chips.forEach((chip) => {
    scope.listen(chip, 'click', () => {
      if (submitted) return;
      const word = chip.dataset.word;
      if (selectedWords.has(word)) {
        selectedWords.delete(word);
        chip.classList.remove('is-selected');
        audio.pop();
      } else {
        selectedWords.add(word);
        chip.classList.add('is-selected');
        audio.tap();
        haptics.tap();
      }

      countEl.textContent = `${selectedWords.size} / ${targetItems.length} selected`;
      submitBtn.disabled = selectedWords.size === 0;
    });
  });

  scope.listen(submitBtn, 'click', () => {
    if (submitted) return;
    submitted = true;
    submitBtn.disabled = true;
    const timeTakenMs = Date.now() - startTime;
    let correctCount = 0;
    let falseAlarms = 0;

    chips.forEach((chip) => {
      chip.disabled = true;
      const isTarget = chip.dataset.isTarget === 'true';
      const isChosen = selectedWords.has(chip.dataset.word);

      if (isTarget && isChosen) {
        chip.classList.add('is-correct');
        correctCount++;
      } else if (!isTarget && isChosen) {
        chip.classList.add('is-wrong');
        falseAlarms++;
      } else if (isTarget && !isChosen) {
        chip.classList.add('is-missed');
      }
    });

    const accuracy = Math.max(0, (correctCount - falseAlarms * 0.5) / targetItems.length);
    const deltaRes = calculateRatingDelta(currentRating, config.tier, accuracy, timeTakenMs, 20000);

    const ratings = getDomainRatings();
    ratings[DOMAINS.MEMORY] = deltaRes.newRating;
    saveDomainRatings(ratings);

    // Save session completion
    session.status = 'completed';
    session.completedAt = Date.now();
    session.results = {
      correctCount,
      totalCount: targetItems.length,
      falseAlarms,
      accuracy,
      timeTakenMs,
      newRating: deltaRes.newRating,
      delta: deltaRes.delta
    };
    saveJSON(KEYS.DELAYED_MEMORY, session);

    logSessionRound({
      gameId: 'delayed-memory',
      domain: DOMAINS.MEMORY,
      tier: config.tier,
      accuracy,
      questionsCount: targetItems.length,
      correctCount,
      averageLatencyMs: timeTakenMs / targetItems.length,
      ratingBefore: currentRating,
      ratingAfter: deltaRes.newRating
    });

    if (accuracy >= 0.7) {
      audio.chime();
      scope.addCleanup(burstConfetti());
      haptics.success();
    } else {
      audio.buzz();
      haptics.warning();
    }

    // Render result summary
    scope.timeout(() => {
      renderSummary(container, session, deltaRes, onComplete, scope);
    }, 1200);
  });
}

function renderSummary(container, session, deltaRes, onComplete, scope) {
  const { correctCount, totalCount, falseAlarms, accuracy } = session.results;
  const hoursSince = ((session.completedAt - session.createdAt) / 3600000).toFixed(1);

  container.innerHTML = `
    <div class="result-summary-card">
      <div class="result-icon">${accuracy >= 0.7 ? '🏆' : '📈'}</div>
      <h3>Recall Evaluation Complete</h3>
      <p class="result-sub">Retention tested after <strong>${hoursSince} hours</strong> of delay.</p>

      <div class="stat-highlight-row">
        <div class="stat-box">
          <span class="stat-box-val">${correctCount} / ${totalCount}</span>
          <span class="stat-box-lbl">Retained</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-val">${Math.round(accuracy * 100)}%</span>
          <span class="stat-box-lbl">Retention Score</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-val ${deltaRes.delta >= 0 ? 'text-green' : 'text-amber'}">
            ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
          </span>
          <span class="stat-box-lbl">Memory Rating (${deltaRes.newRating})</span>
        </div>
      </div>

      <div class="summary-actions">
        <button id="doneBtn" class="btn btn-primary btn-large" type="button">
          Done
        </button>
      </div>
    </div>
  `;

  scope.listen(container.querySelector('#doneBtn'), 'click', () => {
    audio.tap();
    if (onComplete) onComplete();
  });
}
