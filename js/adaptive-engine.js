// Adaptive Engine for Sharp — Dynamic Difficulty Adjustment (DDA) & Skill Rating System
import { loadJSON, saveJSON, KEYS } from './storage.js';

export const DOMAINS = {
  MEMORY: 'memory',
  MATH: 'math',
  LOGIC: 'logic',
  COMPREHENSION: 'comprehension',
  FOCUS: 'focus'
};

export const DEFAULT_RATINGS = {
  memory: 1000,
  math: 1000,
  logic: 1000,
  comprehension: 1000,
  focus: 1000
};

export function getDomainRatings() {
  const stored = loadJSON(KEYS.RATINGS, null);
  if (!stored) {
    saveJSON(KEYS.RATINGS, { ...DEFAULT_RATINGS });
    return { ...DEFAULT_RATINGS };
  }
  return { ...DEFAULT_RATINGS, ...stored };
}

export function saveDomainRatings(ratings) {
  saveJSON(KEYS.RATINGS, ratings);
}

export function getOverallSharpScore(ratings = getDomainRatings()) {
  const values = Object.values(ratings);
  if (!values.length) return 1000;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / values.length);
}

export function ratingToTier(rating) {
  if (rating < 950) return 1;
  if (rating < 1100) return 2;
  if (rating < 1250) return 3;
  if (rating < 1400) return 4;
  if (rating < 1600) return 5;
  if (rating < 1850) return 6;
  return 7;
}

export function getTierLabel(tier) {
  switch (tier) {
    case 1: return 'Foundational';
    case 2: return 'Novice';
    case 3: return 'Intermediate';
    case 4: return 'Proficient';
    case 5: return 'Advanced';
    case 6: return 'Expert';
    case 7: return 'Master';
    default: return 'Grandmaster';
  }
}

/**
 * Calculates Elo rating change for a performance session.
 * @param {number} currentRating Current player rating in the domain
 * @param {number} targetTier Tier of the challenge (1-7)
 * @param {number} accuracy Fraction of questions correct (0.0 to 1.0)
 * @param {number} averageLatencyMs Average response latency in milliseconds
 * @param {number} expectedLatencyMs Benchmark expected latency for this challenge
 * @returns {object} { newRating, delta, tier }
 */
export function calculateRatingDelta(currentRating, targetTier, accuracy, averageLatencyMs, expectedLatencyMs = 4000) {
  const challengeRating = (targetTier - 1) * 150 + 900;
  const expectedAccuracy = 1 / (1 + Math.pow(10, (challengeRating - currentRating) / 400));

  // Base K factor
  const K = 36;
  const rawScoreDiff = accuracy - expectedAccuracy;

  // Speed factor: up to +25% bonus for swift responses, down to -15% if very sluggish
  let speedFactor = 1.0;
  if (accuracy >= 0.7 && averageLatencyMs > 0 && expectedLatencyMs > 0) {
    const ratio = expectedLatencyMs / averageLatencyMs;
    speedFactor = Math.min(1.3, Math.max(0.85, ratio));
  }

  let delta = Math.round(K * rawScoreDiff * speedFactor);

  // Guarantee minimal progression for high accuracy to maintain motivation
  if (accuracy === 1.0 && delta <= 0) delta = 8;
  if (accuracy >= 0.8 && delta < 0) delta = 4;
  if (accuracy < 0.3 && delta > 0) delta = -8;

  const newRating = Math.max(600, Math.min(2500, currentRating + delta));
  return {
    newRating,
    delta,
    tier: ratingToTier(newRating)
  };
}

/**
 * Parameter configurations generated per game based on current rating
 */
export function getGameConfig(gameId, rating) {
  const tier = ratingToTier(rating);

  switch (gameId) {
    case 'delayed-memory': {
      // Morning item count and distractor ratio
      const count = Math.min(9, 3 + Math.floor(tier * 0.9));
      return {
        tier,
        itemCount: count,
        showDurationMs: count * 3500,
        distractorMultiplier: 2, // distractor options in recognition test
        includesNumbers: tier >= 3,
        includesAssociations: tier >= 4
      };
    }

    case 'pattern-flash': {
      // Grid dimensions and distractor count
      const gridSize = tier <= 2 ? 3 : tier <= 4 ? 4 : 5;
      const patternCount = tier <= 2 ? 3 : tier <= 4 ? 4 : 5;
      const distractorCount = Math.min(6, 1 + tier);
      const displayMs = Math.max(900, 2200 - tier * 180);
      return {
        tier,
        gridSize,
        patternCount,
        distractorCount,
        displayMs,
        requiresDrawing: tier >= 3
      };
    }

    case 'math-arithmetic': {
      // Number range and operators
      let ops = ['+', '-'];
      let maxNum = 20;
      let terms = 2;
      if (tier >= 2) { ops.push('*'); maxNum = 50; }
      if (tier >= 3) { ops.push('/'); maxNum = 100; terms = 2; }
      if (tier >= 4) { terms = 3; maxNum = 150; }
      if (tier >= 5) { ops.push('^', '%'); maxNum = 200; terms = 3; }
      return {
        tier,
        operators: ops,
        maxNumber: maxNum,
        termsCount: terms,
        timePerQuestionMs: Math.max(4000, 12000 - tier * 1000)
      };
    }

    case 'story-math': {
      // Natural language word problems
      return {
        tier,
        steps: Math.min(4, 1 + Math.floor(tier / 2)),
        includeDistractorFacts: tier >= 3,
        timePerQuestionMs: Math.max(10000, 25000 - tier * 1500)
      };
    }

    case 'logic-deduction': {
      return {
        tier,
        premiseCount: Math.min(4, 2 + Math.floor(tier / 2)),
        useNegations: tier >= 2,
        useQuantifiers: tier >= 3,
        timePerQuestionMs: Math.max(8000, 20000 - tier * 1500)
      };
    }

    case 'comprehension-inference': {
      return {
        tier,
        passageLength: tier <= 2 ? 'short' : tier <= 4 ? 'medium' : 'dense',
        distractorSubtlety: tier,
        timePerQuestionMs: Math.max(12000, 30000 - tier * 2000)
      };
    }

    case 'corsi-span': {
      const startSpan = Math.min(8, 2 + tier);
      return {
        tier,
        startSpan,
        blockSize: tier >= 4 ? 9 : 7,
        flashDurationMs: Math.max(450, 800 - tier * 50)
      };
    }

    default:
      return { tier };
  }
}
