import { localDayKey } from '../js/core/calendar.js';
// Central Question Dataset Engine & Hydration Layer for Sharp
// Unifies Logic, Math, Comprehension, and Memory datasets with continuous metadata hydration

import { LOGIC_PUZZLES } from './domains/logic-puzzles.js';
import { MATH_PROBLEMS } from './domains/math-problems.js';
import { COMPREHENSION_PASSAGES } from './domains/comprehension-passages.js';
import { MEMORY_CLUSTERS } from './domains/memory-clusters.js';
import { loadJSON, saveJSON } from '../js/storage.js';
import { isRecord, validateQuestion, MAX_IMPORT_BYTES } from '../js/content-validation.js';

const STATS_KEY = 'question_stats';
const CUSTOM_QUESTIONS_KEY = 'custom_questions';

/**
 * Returns all built-in and user-imported questions.
 */
export function getAllQuestions() {
  const storedCustom = loadJSON(CUSTOM_QUESTIONS_KEY, []);
  const custom = Array.isArray(storedCustom) ? storedCustom : [];
  const base = [
    ...LOGIC_PUZZLES,
    ...MATH_PROBLEMS,
    ...COMPREHENSION_PASSAGES
  ];

  // Imported questions may append, but never replace curated built-in IDs.
  const questionMap = new Map();
  base.forEach((q) => questionMap.set(q.id, { ...q }));
  custom.filter((q) => validateQuestion(q).valid).forEach((q) => {
    if (!questionMap.has(q.id)) questionMap.set(q.id, { ...q });
  });

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
    if (new TextEncoder().encode(payload).length > MAX_IMPORT_BYTES) return { success: false, error: 'Question pack exceeds 5 MiB.' };
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
  if (questions.length > 5000) return { success: false, error: 'Question pack exceeds 5,000 items.' };
  const builtInIds = new Set([...LOGIC_PUZZLES, ...MATH_PROBLEMS, ...COMPREHENSION_PASSAGES].map((q) => q.id));
  const packIds = new Set();

  questions.forEach((q, index) => {
    const validation = validateQuestion(q);
    if (!validation.valid || builtInIds.has(q.id) || packIds.has(q.id)) {
      errors.push(`Item ${index + 1}: ${validation.error || 'Duplicate or reserved built-in ID.'}`);
      return;
    }
    packIds.add(q.id);

    validQuestions.push({
      ...q,
      metadata: {
        version: q.metadata?.version || 1,
        dateAdded: q.metadata?.dateAdded || localDayKey(),
        timesServed: 0,
        userAccuracy: null,
        ...(isRecord(q.metadata) ? q.metadata : {})
      }
    });
  });

  if (errors.length || validQuestions.length === 0) {
    return { success: false, error: 'Question pack was not imported. Fix the invalid items and retry.', errors };
  }

  if (new TextEncoder().encode(JSON.stringify(validQuestions)).length > MAX_IMPORT_BYTES) {
    return { success: false, error: 'Question pack exceeds 5 MiB.' };
  }

  const currentCustom = loadJSON(CUSTOM_QUESTIONS_KEY, []);
  const customMap = new Map();
  (Array.isArray(currentCustom) ? currentCustom : []).filter((q) => validateQuestion(q).valid)
    .forEach((q) => customMap.set(q.id, q));
  validQuestions.forEach((q) => customMap.set(q.id, q));

  if (!saveJSON(CUSTOM_QUESTIONS_KEY, Array.from(customMap.values()))) {
    return { success: false, error: 'Could not save question pack. Check available browser storage.' };
  }

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
