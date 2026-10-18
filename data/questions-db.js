// Central Question Dataset Engine & Hydration Layer for Sharp
// Unifies Logic, Math, Comprehension, and Memory datasets with continuous metadata hydration

import { LOGIC_PUZZLES } from './domains/logic-puzzles.js';
import { MATH_PROBLEMS } from './domains/math-problems.js';
import { COMPREHENSION_PASSAGES } from './domains/comprehension-passages.js';
import { MEMORY_CLUSTERS } from './domains/memory-clusters.js';
import { loadJSON, saveJSON } from '../js/storage.js';

const STATS_KEY = 'question_stats';
const CUSTOM_QUESTIONS_KEY = 'custom_questions';

/**
 * Returns all built-in and user-imported questions.
 */
export function getAllQuestions() {
  const custom = loadJSON(CUSTOM_QUESTIONS_KEY, []);
  const base = [
    ...LOGIC_PUZZLES,
    ...MATH_PROBLEMS,
    ...COMPREHENSION_PASSAGES
  ];

  // Merge base with custom, where custom can override or append by ID
  const questionMap = new Map();
  base.forEach((q) => questionMap.set(q.id, { ...q }));
  custom.forEach((q) => questionMap.set(q.id, { ...q }));

  // Hydrate with local runtime stats
  const stats = loadJSON(STATS_KEY, {});
  questionMap.forEach((q, id) => {
    if (stats[id]) {
      q.metadata = {
        ...q.metadata,
        timesServed: stats[id].timesServed || 0,
        correctCount: stats[id].correctCount || 0,
        userAccuracy: stats[id].timesServed > 0
          ? Number((stats[id].correctCount / stats[id].timesServed).toFixed(2))
          : null,
        averageLatencyMs: stats[id].averageLatencyMs || null,
        lastAttempted: stats[id].lastAttempted || null
      };
    }
  });

  return Array.from(questionMap.values());
}

export function getQuestionById(id) {
  const all = getAllQuestions();
  return all.find((q) => q.id === id) || null;
}

export function getQuestionsByDomain(domain, tier = null, count = 5) {
  const all = getAllQuestions();
  let filtered = all.filter((q) => q.domain === domain);

  if (tier !== null) {
    // Score questions by proximity to player's current tier
    filtered.sort((a, b) => {
      const distA = Math.abs(a.difficultyTier - tier);
      const distB = Math.abs(b.difficultyTier - tier);
      if (distA === distB) {
        // Less frequently served questions take priority (anti-repetition)
        const servedA = a.metadata?.timesServed || 0;
        const servedB = b.metadata?.timesServed || 0;
        return servedA - servedB;
      }
      return distA - distB;
    });
  } else {
    filtered.sort(() => Math.random() - 0.5);
  }

  return filtered.slice(0, count);
}

export function getMemoryCluster(tier = 2) {
  const clusters = [...MEMORY_CLUSTERS];
  clusters.sort((a, b) => Math.abs(a.difficultyTier - tier) - Math.abs(b.difficultyTier - tier));
  return clusters[0] || MEMORY_CLUSTERS[0];
}

/**
 * Hydrates a question attempt into persistent metadata.
 */
export function recordQuestionAttempt(questionId, isCorrect, latencyMs = 0) {
  const stats = loadJSON(STATS_KEY, {});
  const current = stats[questionId] || {
    timesServed: 0,
    correctCount: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0
  };

  current.timesServed += 1;
  if (isCorrect) current.correctCount += 1;
  current.totalLatencyMs += latencyMs;
  current.averageLatencyMs = Math.round(current.totalLatencyMs / current.timesServed);
  current.lastAttempted = new Date().toISOString();

  stats[questionId] = current;
  saveJSON(STATS_KEY, stats);
  return current;
}

/**
 * Imports an external question pack (JSON array of valid questions).
 */
export function importQuestionPack(payload) {
  let questions = payload;
  if (typeof payload === 'string') {
    try {
      questions = JSON.parse(payload);
    } catch {
      return { success: false, error: 'Invalid JSON string' };
    }
  }

  if (!Array.isArray(questions)) {
    if (questions && Array.isArray(questions.questions)) {
      questions = questions.questions;
    } else {
      return { success: false, error: 'Expected an array of question objects' };
    }
  }

  const validQuestions = [];
  const errors = [];

  questions.forEach((q, index) => {
    if (!q.id || !q.domain || !q.question || !q.correctAnswer) {
      errors.push(`Item at index ${index} missing required fields (id, domain, question, or correctAnswer)`);
      return;
    }

    validQuestions.push({
      ...q,
      metadata: {
        version: q.metadata?.version || 1,
        dateAdded: q.metadata?.dateAdded || new Date().toISOString().slice(0, 10),
        timesServed: 0,
        userAccuracy: null,
        ...q.metadata
      }
    });
  });

  if (validQuestions.length === 0) {
    return { success: false, error: 'No valid questions found', errors };
  }

  const currentCustom = loadJSON(CUSTOM_QUESTIONS_KEY, []);
  const customMap = new Map();
  currentCustom.forEach((q) => customMap.set(q.id, q));
  validQuestions.forEach((q) => customMap.set(q.id, q));

  saveJSON(CUSTOM_QUESTIONS_KEY, Array.from(customMap.values()));

  return {
    success: true,
    importedCount: validQuestions.length,
    totalCustomCount: customMap.size,
    errors
  };
}

/**
 * Exports the entire hydrated dataset as a versioned JSON blob.
 */
export function exportHydratedDataset() {
  const all = getAllQuestions();
  const clusters = MEMORY_CLUSTERS;
  const payload = {
    appName: 'sharp',
    datasetVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    totalQuestions: all.length,
    domainsSummary: {
      logic: all.filter((q) => q.domain === 'logic').length,
      math: all.filter((q) => q.domain === 'math').length,
      comprehension: all.filter((q) => q.domain === 'comprehension').length,
      memoryClusters: clusters.length
    },
    questions: all,
    memoryClusters: clusters
  };

  return payload;
}

/**
 * Returns dataset summary analytics for UI inspectors.
 */
export function getDatasetStats() {
  const all = getAllQuestions();
  const total = all.length;
  const stats = loadJSON(STATS_KEY, {});
  const attemptedCount = Object.keys(stats).length;

  let totalAttempts = 0;
  let totalCorrect = 0;
  Object.values(stats).forEach((s) => {
    totalAttempts += s.timesServed;
    totalCorrect += s.correctCount;
  });

  return {
    totalQuestions: total,
    attemptedQuestions: attemptedCount,
    coveragePercent: total > 0 ? Math.round((attemptedCount / total) * 100) : 0,
    totalAttemptsRecorded: totalAttempts,
    overallAccuracyPercent: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    byDomain: {
      logic: all.filter((q) => q.domain === 'logic').length,
      math: all.filter((q) => q.domain === 'math').length,
      comprehension: all.filter((q) => q.domain === 'comprehension').length,
      memory: MEMORY_CLUSTERS.length
    }
  };
}
