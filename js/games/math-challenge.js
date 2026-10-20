import { createSessionScope, bindChoiceShortcuts } from '../core/session-scope.js';
import { escapeHTML } from '../content-validation.js';
// Mental Math & Story Comprehension Challenge
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { getDomainRatings, saveDomainRatings, calculateRatingDelta, getGameConfig, DOMAINS } from '../adaptive-engine.js';
import { logSessionRound } from '../analytics.js';
import { getQuestionsByDomain, recordQuestionAttempt } from '../../data/questions-db.js';

export function renderArithmetic(container, onComplete) {
  return renderMathGame(container, 'arithmetic', onComplete);
}

export function renderStoryMath(container, onComplete) {
  return renderMathGame(container, 'story', onComplete);
}

export function render(container, onComplete) {
  // Default to arithmetic or story depending on catalog selection
  return renderArithmetic(container, onComplete);
}

function renderMathGame(container, mode, onComplete) {
  const scope = createSessionScope();
  onComplete = scope.once(onComplete || (() => {}));
  scope.listen(container, 'keydown', (event) => {
    if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault();
  });
  const ratings = getDomainRatings();
  const currentRating = ratings[DOMAINS.MATH] || 1000;
  const config = getGameConfig(mode === 'story' ? 'story-math' : 'math-arithmetic', currentRating);

  const title = mode === 'story' ? 'Story Math & Comprehension' : 'Mental Arithmetic';
  const subtitle = mode === 'story'
    ? 'Translate verbal situations into mathematical equations and solve.'
    : 'Rapid-fire adaptive arithmetic scaling from basic operations to multi-step logic.';

  container.innerHTML = `
    <div class="game-shell math-game-shell">
      <div class="game-header">
        <div class="game-meta">
          <span class="game-badge">Math • Tier ${config.tier}</span>
          <h2 class="game-title">${title}</h2>
          <p class="game-subtitle">${subtitle}</p>
        </div>
      </div>
      <div id="mathStage" class="game-body math-stage"></div>
    </div>
  `;

  const stage = container.querySelector('#mathStage');
  runMathSession(stage, mode, config, currentRating, onComplete, scope);
  return scope.dispose;
}

function runMathSession(stage, mode, config, currentRating, onComplete, scope) {
  const dbStoryProblems = mode === 'story' ? getQuestionsByDomain('math', config.tier, 5) : [];
  const totalQuestions = mode === 'story' ? Math.max(5, dbStoryProblems.length) : 8;
  let questionIndex = 0;
  let correctCount = 0;
  const latencies = [];

  function showQuestion() {
    if (questionIndex >= totalQuestions) {
      finishGame();
      return;
    }

    let problem;
    if (mode === 'story') {
      problem = dbStoryProblems[questionIndex] || generateStoryProblem(config.tier);
    } else {
      problem = generateArithmeticProblem(config);
    }
    const qStartTime = Date.now();

    stage.innerHTML = `
      <div class="math-question-card">
        <div class="math-question-meta">
          <span>Question ${questionIndex + 1} of ${totalQuestions}</span>
          <span class="difficulty-tag">Tier ${config.tier}</span>
        </div>

        <div id="mathQuestionPrompt" class="math-expression-display ${mode === 'story' ? 'is-story' : ''}">
          ${escapeHTML(problem.prompt).replace(/&lt;(\/?)strong&gt;/g, '<$1strong>')}
        </div>

        <div class="math-options-grid" id="optionsGrid" role="group" aria-labelledby="mathQuestionPrompt">
          ${problem.options.map((opt, i) => `
            <button class="btn math-option-btn" type="button" data-val="${escapeHTML(opt)}" data-shortcut="${i + 1}">
              <span class="opt-key">${i + 1}</span>
              <span class="opt-val">${escapeHTML(opt)}</span>
            </button>
          `).join('')}
        </div>
        <div id="mathExplanation" class="question-feedback" role="status" hidden></div>
        <div class="question-next-row" hidden>
          <button id="mathNextBtn" class="btn btn-primary" type="button" aria-describedby="mathExplanation">
            ${questionIndex + 1 === totalQuestions ? 'View results' : 'Next question'}
          </button>
        </div>
      </div>
    `;

    const btns = stage.querySelectorAll('.math-option-btn');
    let answered = false;

    function handleChoice(val, btnEl) {
      if (answered) return;
      answered = true;
      removeKeyListener();

      const latency = Date.now() - qStartTime;
      latencies.push(latency);

      const isCorrect = Number(val) === Number(problem.correctAnswer);
      if (problem.id) {
        recordQuestionAttempt(problem.id, isCorrect, latency);
      }
      if (isCorrect) {
        correctCount++;
        btnEl.classList.add('is-correct');
        audio.chime();
        haptics.success();
      } else {
        btnEl.classList.add('is-wrong');
        audio.buzz();
        haptics.warning();
        // Highlight correct option
        btns.forEach((b) => {
          if (Number(b.dataset.val) === Number(problem.correctAnswer)) {
            b.classList.add('is-correct');
          }
        });
      }

      btns.forEach((b) => (b.disabled = true));

      const explanationEl = stage.querySelector('#mathExplanation');
      explanationEl.textContent = `${isCorrect ? '✓ Correct.' : '✗ Incorrect.'} ${problem.explanation || `The correct answer is ${problem.correctAnswer}.`}`;
      explanationEl.hidden = false;

      const nextButton = stage.querySelector('#mathNextBtn');
      nextButton.parentElement.hidden = false;
      scope.listen(nextButton, 'click', scope.once(() => {
        nextButton.disabled = true;
        questionIndex++;
        showQuestion();
      }));
      nextButton.focus();
    }

    btns.forEach((btn) => {
      scope.listen(btn, 'click', () => {
        handleChoice(btn.dataset.val, btn);
      });
    });

    const removeKeyListener = bindChoiceShortcuts(scope, btns, handleChoice);
    if (questionIndex > 0) btns[0]?.focus();
  }

  const finishGame = scope.once(() => {
    const accuracy = correctCount / totalQuestions;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const expectedLatency = mode === 'story' ? 14000 : 4500;
    const deltaRes = calculateRatingDelta(currentRating, config.tier, accuracy, avgLatency, expectedLatency);

    const ratings = getDomainRatings();
    ratings[DOMAINS.MATH] = deltaRes.newRating;
    saveDomainRatings(ratings);

    logSessionRound({
      gameId: mode === 'story' ? 'story-math' : 'math-arithmetic',
      domain: DOMAINS.MATH,
      tier: config.tier,
      accuracy,
      questionsCount: totalQuestions,
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
        <div class="result-icon">${accuracy >= 0.75 ? '🎉' : '📊'}</div>
        <h3>Session Complete</h3>
        <p class="result-sub">You scored <strong>${correctCount} out of ${totalQuestions}</strong> correct.</p>

        <div class="stat-highlight-row">
          <div class="stat-box">
            <span class="stat-box-val">${Math.round(accuracy * 100)}%</span>
            <span class="stat-box-lbl">Accuracy</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val ${(deltaRes.delta >= 0 ? 'text-green' : 'text-amber')}">
              ${deltaRes.delta >= 0 ? '+' : ''}${deltaRes.delta}
            </span>
            <span class="stat-box-lbl">Math Rating (${deltaRes.newRating})</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-val">${(avgLatency / 1000).toFixed(1)}s</span>
            <span class="stat-box-lbl">Avg Response</span>
          </div>
        </div>

        <div class="summary-actions">
          <button id="mathDoneBtn" class="btn btn-primary btn-large" type="button">Done</button>
        </div>
      </div>
    `;

    scope.listen(stage.querySelector('#mathDoneBtn'), 'click', () => {
      audio.tap();
      if (onComplete) onComplete();
    });
    const heading = stage.querySelector('.result-summary-card h3');
    heading.tabIndex = -1;
    heading.focus();
  });

  showQuestion();
}

/**
 * Procedural arithmetic generator
 */
export function generateArithmeticProblem(config, random = Math.random) {
  const { operators, maxNumber, termsCount } = config;
  const op = operators[Math.floor(random() * operators.length)];

  let prompt = '';
  let answer = 0;

  if (op === '+') {
    const a = Math.floor(random() * maxNumber) + 5;
    const b = Math.floor(random() * maxNumber) + 5;
    if (termsCount === 3) {
      const c = Math.floor(random() * (maxNumber / 2)) + 2;
      prompt = `${a} + ${b} + ${c} = ?`;
      answer = a + b + c;
    } else {
      prompt = `${a} + ${b} = ?`;
      answer = a + b;
    }
  } else if (op === '-') {
    const a = Math.floor(random() * maxNumber) + 15;
    const b = Math.floor(random() * (a - 5)) + 3;
    prompt = `${a} − ${b} = ?`;
    answer = a - b;
  } else if (op === '*') {
    const a = Math.floor(random() * (config.tier >= 4 ? 25 : 12)) + 3;
    const b = Math.floor(random() * 12) + 2;
    prompt = `${a} × ${b} = ?`;
    answer = a * b;
  } else if (op === '/') {
    const b = Math.floor(random() * 11) + 2;
    const mult = Math.floor(random() * (config.tier >= 4 ? 20 : 12)) + 2;
    const a = b * mult;
    prompt = `${a} ÷ ${b} = ?`;
    answer = mult;
  } else if (op === '^') {
    const base = Math.floor(random() * 8) + 4;
    prompt = `${base}² = ?`;
    answer = base * base;
  } else {
    // Percentages: e.g. 15% of 80
    const percents = [10, 20, 25, 50];
    const p = percents[Math.floor(random() * percents.length)];
    const val = (Math.floor(random() * 10) + 1) * 20;
    prompt = `${p}% of ${val} = ?`;
    answer = Math.round((p / 100) * val);
  }

  const options = generateOptions(answer, random);
  return { prompt, correctAnswer: answer, options };
}

/**
 * Procedural story problem generator
 */
export function generateStoryProblem(tier, random = Math.random) {
  const templates = [
    // Template 1: Fruit/Item exchange (Jack & Jill style)
    () => {
      const names = [['Jack', 'Jill'], ['Maya', 'Leo'], ['Emma', 'Noah'], ['Liam', 'Sophia']];
      const [p1, p2] = names[Math.floor(random() * names.length)];
      const item = ['apples', 'oranges', 'peaches', 'books'][Math.floor(random() * 4)];
      const start = Math.floor(random() * 20) + 15;
      const given = Math.floor(random() * 8) + 4;
      const found = Math.floor(random() * 6) + 3;

      if (tier <= 2) {
        return {
          prompt: `${p1} has <strong>${start} ${item}</strong>. ${p1} gives ${p2} <strong>${given}</strong>, then finds <strong>${found} more</strong>. How many ${item} does ${p1} have now?`,
          answer: start - given + found
        };
      } else {
        const bonus = Math.floor(random() * 5) + 2;
        return {
          prompt: `${p1} has <strong>${start} ${item}</strong>. ${p1} gives ${p2} <strong>${given}</strong>. ${p2} shares half of those with a friend, and gives ${p1} back <strong>${bonus}</strong> as a thank you. How many ${item} does ${p1} have now?`,
          answer: start - given + bonus
        };
      }
    },

    // Template 2: Bakery / Inventory
    () => {
      const baked = (Math.floor(random() * 5) + 3) * 12; // dozens
      const soldMorning = Math.floor(baked * 0.5);
      const afternoonBake = Math.floor(random() * 15) + 10;
      const soldAfternoon = Math.floor(random() * 12) + 5;
      return {
        prompt: `A bakery bakes <strong>${baked} muffins</strong> in the morning and sells <strong>${soldMorning}</strong>. In the afternoon, they bake <strong>${afternoonBake} more</strong> and sell <strong>${soldAfternoon}</strong>. How many muffins remain at closing?`,
        answer: (baked - soldMorning) + afternoonBake - soldAfternoon
      };
    },

    // Template 3: Travel & Speed
    () => {
      const speed1 = 40 + Math.floor(random() * 4) * 10; // 40, 50, 60, 70
      const hours1 = 2;
      const speed2 = 60;
      const hours2 = 1.5;
      const totalDist = Math.round(speed1 * hours1 + speed2 * hours2);
      return {
        prompt: `A commuter drives at <strong>${speed1} km/h for ${hours1} hours</strong>, then takes the highway at <strong>${speed2} km/h for ${hours2} hours</strong>. What is the total distance traveled?`,
        answer: totalDist
      };
    },

    // Template 4: Shopping discount & budget
    () => {
      const price = (Math.floor(random() * 6) + 4) * 10; // 40, 50, 60...
      const discountPercent = 20;
      const discountedPrice = price * 0.8;
      const coupon = 5;
      return {
        prompt: `A sweater priced at <strong>$${price}</strong> is on sale for <strong>${discountPercent}% off</strong>. At checkout, an additional <strong>$${coupon} coupon</strong> is applied. What is the final price?`,
        answer: discountedPrice - coupon
      };
    }
  ];

  const chosen = templates[Math.floor(random() * templates.length)]();
  const options = generateOptions(chosen.answer, random);
  return { prompt: chosen.prompt, correctAnswer: chosen.answer, options };
}

function generateOptions(correctAnswer, random) {
  const options = new Set([correctAnswer]);
  const offsets = [-10, -5, -2, -1, 1, 2, 5, 10, 15];
  shuffleOptions(offsets, random);

  for (const offset of offsets) {
    if (options.size >= 4) break;
    const candidate = correctAnswer + offset;
    if (candidate > 0 && candidate !== correctAnswer) {
      options.add(candidate);
    }
  }

  // If still less than 4, add random nearby numbers
  let fallbackDelta = 3;
  while (options.size < 4) {
    options.add(correctAnswer + fallbackDelta);
    fallbackDelta += 2;
  }

  return shuffleOptions(Array.from(options), random);
}

function shuffleOptions(items, random) {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
