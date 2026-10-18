// Daily Workout View — Curated 4-Exercise Cognitive Fitness Circuit
import { loadJSON, saveJSON, KEYS } from '../storage.js';
import { audio } from '../audio.js';
import { burstConfetti } from '../celebration.js';
import { getStreaks, recordWorkoutCompletion } from '../analytics.js';
import { shouldRemindBackup } from '../backup.js';

import * as DelayedMemoryGame from '../games/delayed-memory.js';
import * as MathChallengeGame from '../games/math-challenge.js';
import * as LogicDeductionGame from '../games/logic-deduction.js';
import * as ComprehensionGame from '../games/comprehension-inference.js';
import * as PatternFlashGame from '../games/pattern-flash.js';

const WORKOUT_CIRCUIT = [
  { id: 'memory', title: 'Pattern Interference', module: PatternFlashGame },
  { id: 'math', title: 'Mental Arithmetic', module: MathChallengeGame },
  { id: 'logic', title: 'Deductive Syllogisms', module: LogicDeductionGame },
  { id: 'comprehension', title: 'Speed Inference', module: ComprehensionGame }
];

export function render(container, navigateTo) {
  const streaks = getStreaks();
  const today = new Date().toISOString().slice(0, 10);
  const isDoneToday = streaks.lastWorkoutDate === today;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Daily Workout</h1>
        <p class="view-desc">A curated 4-exercise circuit calibrated to challenge all cognitive faculties.</p>
      </div>
      <div class="streak-pill" title="Current Daily Streak">
        <span class="streak-flame">🔥</span>
        <span class="streak-count">${streaks.current}</span>
        <span class="streak-label">day streak</span>
      </div>
    </div>

    ${shouldRemindBackup() && isDoneToday ? `
      <div class="backup-reminder-banner">
        <div class="banner-content">
          <span class="banner-icon">💾</span>
          <div>
            <strong>Daily Workout Recorded!</strong>
            <p>Download a quick backup to ensure your streak and stats are preserved offline.</p>
          </div>
        </div>
        <button id="backupBannerBtn" class="btn btn-sm btn-primary" type="button">Backup Now</button>
      </div>
    ` : ''}

    <div id="workoutStage" class="workout-stage-container">
      ${isDoneToday ? renderCompletedCard(streaks) : renderIntroCard()}
    </div>
  `;

  if (shouldRemindBackup() && isDoneToday) {
    container.querySelector('#backupBannerBtn')?.addEventListener('click', () => {
      audio.tap();
      navigateTo('backup');
    });
  }

  const stage = container.querySelector('#workoutStage');

  stage.querySelector('#startWorkoutBtn')?.addEventListener('click', () => {
    audio.tap();
    startCircuit(stage, 0, navigateTo);
  });

  stage.querySelector('#replayWorkoutBtn')?.addEventListener('click', () => {
    audio.tap();
    startCircuit(stage, 0, navigateTo);
  });

  stage.querySelector('#morningDropBtn')?.addEventListener('click', () => {
    audio.tap();
    navigateTo('games/delayed-memory');
  });
}

function renderIntroCard() {
  return `
    <div class="workout-card">
      <div class="workout-card-badge">Today's Circuit</div>
      <h2 class="workout-card-title">Daily Cognitive Balance</h2>
      <p class="workout-card-desc">Complete 4 short rounds (approximately 8 minutes) to train pattern memory, arithmetic calculation, deductive logic, and speed comprehension.</p>

      <div class="circuit-steps-list">
        ${WORKOUT_CIRCUIT.map((item, idx) => `
          <div class="circuit-step-item">
            <span class="step-num">${idx + 1}</span>
            <div class="step-info">
              <strong>${item.title}</strong>
              <small>${item.id.toUpperCase()}</small>
            </div>
            <span class="step-tag">Ready</span>
          </div>
        `).join('')}
      </div>

      <div class="workout-card-actions">
        <button id="startWorkoutBtn" class="btn btn-primary btn-large btn-glow" type="button">
          ⚡ Begin Workout
        </button>
        <button id="morningDropBtn" class="btn btn-outline" type="button">
          🌅 Check Morning / Evening Memory Drop
        </button>
      </div>
    </div>
  `;
}

function renderCompletedCard(streaks) {
  return `
    <div class="workout-card is-completed">
      <div class="completed-icon">🏅</div>
      <h2 class="workout-card-title">Daily Workout Complete!</h2>
      <p class="workout-card-desc">You've finished your cognitive training for today. Your ${streaks.current}-day streak is secured!</p>

      <div class="streak-celebration-box">
        <span class="big-flame">🔥</span>
        <div class="streak-data">
          <strong>${streaks.current} Consecutive Days</strong>
          <small>Longest streak: ${streaks.longest} days</small>
        </div>
      </div>

      <div class="workout-card-actions">
        <button id="replayWorkoutBtn" class="btn btn-secondary" type="button">
          Train Again (Free Practice)
        </button>
        <button id="morningDropBtn" class="btn btn-outline" type="button">
          Check Time-Capsule Memory
        </button>
      </div>
    </div>
  `;
}

function startCircuit(container, stepIndex, navigateTo) {
  if (stepIndex >= WORKOUT_CIRCUIT.length) {
    // Finished all 4 exercises!
    const { streaks } = recordWorkoutCompletion();
    audio.streak();
    burstConfetti();

    container.innerHTML = `
      <div class="workout-card is-completed">
        <div class="completed-icon">🏆</div>
        <h2 class="workout-card-title">Circuit Completed!</h2>
        <p class="workout-card-desc">Outstanding work! All 4 cognitive domains were activated and your streak is updated.</p>

        <div class="streak-celebration-box">
          <span class="big-flame">🔥</span>
          <div class="streak-data">
            <strong>${streaks.current} Day Streak!</strong>
            <small>Personal Best: ${streaks.longest} days</small>
          </div>
        </div>

        <div class="workout-card-actions">
          <button id="viewAnalyticsBtn" class="btn btn-primary btn-large" type="button">
            View Updated Insights &amp; Radar
          </button>
        </div>
      </div>
    `;

    container.querySelector('#viewAnalyticsBtn').addEventListener('click', () => {
      audio.tap();
      navigateTo('analytics');
    });
    return;
  }

  const currentExercise = WORKOUT_CIRCUIT[stepIndex];

  container.innerHTML = `
    <div class="circuit-progress-bar">
      <div class="circuit-progress-info">
        <span>Step ${stepIndex + 1} of ${WORKOUT_CIRCUIT.length}: <strong>${currentExercise.title}</strong></span>
        <span>${Math.round(((stepIndex) / WORKOUT_CIRCUIT.length) * 100)}% Complete</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${(stepIndex / WORKOUT_CIRCUIT.length) * 100}%"></div>
      </div>
    </div>
    <div id="exerciseHost"></div>
  `;

  const host = container.querySelector('#exerciseHost');
  currentExercise.module.render(host, () => {
    startCircuit(container, stepIndex + 1, navigateTo);
  });
}
