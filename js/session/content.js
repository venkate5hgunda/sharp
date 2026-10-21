import { DISCOVERY_QUESTIONS, DISCOVERY_MEMORY } from '../../data/packs/discovery-v3.js';
import { LOGIC_PUZZLES } from '../../data/domains/logic-puzzles.js';
import { MATH_PROBLEMS } from '../../data/domains/math-problems.js';
import { COMPREHENSION_PASSAGES } from '../../data/domains/comprehension-passages.js';
import { MEMORY_CLUSTERS } from '../../data/domains/memory-clusters.js';
import { generateArithmeticProblem, generateStoryProblem } from '../games/math-challenge.js';
import { validateQuestion, isSafeData } from '../content-validation.js';
import { FOUNDATION_QUESTIONS, FOUNDATION_MEMORY } from '../../data/packs/foundation-v2.js';
import { verifyProof } from '../content/solvers.js';

export function randomSource(seed) {
  let value = 2166136261;
  for (const ch of String(seed)) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return () => { value |= 0; value = value + 0x6D2B79F5 | 0; let t = Math.imul(value ^ value >>> 15, 1 | value);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, seed) {
  const result = [...items], random = randomSource(seed);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const plain = (text) => String(text || '').replace(/<\/?(?:strong|em)>/g, '');
export function normalizeQuestion(q, origin = 'curated') {
  return { id: q.id, version: q.metadata?.version || 1, schemaVersion: 2, domain: q.domain,
    skill: q.skill, category: q.category, tier: q.difficultyTier, locale: 'en',
    title: q.title || q.category, prompt: plain(q.prompt || q.question), question: plain(q.question || q.prompt),
    passage: q.passage || '', premises: q.premises || [], explanation: plain(q.explanation),
    options: q.options.map((value, i) => ({ id: `o${i}`, text: String(value) })),
    correctOptionId: `o${q.options.indexOf(q.correctAnswer)}`, origin,
    validation: origin === 'curated' ? 'authored' : 'imported-unrated',
    evidence: q.evidence || '', proof: q.proof || null };
}
export const BASE_CONTENT = [...MATH_PROBLEMS, ...LOGIC_PUZZLES, ...COMPREHENSION_PASSAGES, ...FOUNDATION_QUESTIONS, ...DISCOVERY_QUESTIONS].map((q) => {
  const item = normalizeQuestion(q);
  if (item.proof) { if (!verifyProof(item)) throw new Error(`Invalid curriculum proof: ${item.id}`); item.validation = 'solver-verified'; }
  return item;
});
export const MEMORY_CONTENT = [...MEMORY_CLUSTERS, ...FOUNDATION_MEMORY, ...DISCOVERY_MEMORY];
export function validateItem(q) {
  if (!isSafeData(q) || q.schemaVersion !== 2 || typeof q.id !== 'string' || !/^[\w.-]{1,160}$/.test(q.id) ||
    ['__proto__', 'prototype', 'constructor'].includes(q.id) || !Number.isInteger(q.version) || q.version < 1 ||
    !['math', 'logic', 'comprehension', 'memory'].includes(q.domain) || !Number.isInteger(q.tier) || q.tier < 1 || q.tier > 7 ||
    typeof q.skill !== 'string' || !q.skill || typeof q.prompt !== 'string' || !q.prompt ||
    typeof q.explanation !== 'string' || !q.explanation || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 ||
    q.options.some((o) => typeof o.id !== 'string' || !/^[\w-]{1,80}$/.test(o.id) || typeof o.text !== 'string' || !o.text) ||
    new Set(q.options.map((o) => o.id)).size !== q.options.length || new Set(q.options.map((o) => o.text)).size !== q.options.length ||
    !q.options.some((o) => o.id === q.correctOptionId)) return false;
  return true;
}
export function importedItems(content = []) {
  const reserved = new Set(BASE_CONTENT.map((q) => q.id));
  return content.map((q) => q.schemaVersion === 2 ? { ...q, origin: 'imported', validation: 'imported-unrated' }
    : validateQuestion(q).valid ? normalizeQuestion(q, 'imported') : null).filter((q) => q && !reserved.has(q.id) && validateItem(q));
}
export function selectQuestions(items, { domain, tier, count, seed, attempts = {}, skill, category, exclude = [] }) {
  const exposures = {};
  Object.values(attempts).forEach((a) => { const e = exposures[a.itemId] ||= { count: 0, last: 0 }; e.count++; e.last = Math.max(e.last, a.timestamp); });
  const candidates = shuffle(items.filter((q) => q.domain === domain && (!skill || q.skill === skill) &&
    (!category || q.category === category) && !exclude.includes(q.id) && validateItem(q)), seed);
  // Due, lightly exposed material first; nearby tiers break ties. Shuffle supplies stable unbiased tie breaks.
  candidates.sort((a, b) => (exposures[a.id]?.count || 0) - (exposures[b.id]?.count || 0) ||
    Math.abs(a.tier - tier) - Math.abs(b.tier - tier) || (exposures[a.id]?.last || 0) - (exposures[b.id]?.last || 0));
  const selected = [], skills = new Set();
  for (const q of candidates) if (!skills.has(q.skill) && selected.length < count) { selected.push(q); skills.add(q.skill); }
  for (const q of candidates) if (!selected.includes(q) && selected.length < count) selected.push(q);
  return selected.map((q) => ({ ...structuredClone(q), options: shuffle(q.options, `${seed}:${q.id}`),
    selectionReason: Math.abs(q.tier - tier) ? 'skill coverage; nearby tier' : 'skill coverage; least exposed' }));
}
export function arithmeticItems(config, seed, count = 8, story = false) {
  const random = randomSource(seed);
  // The seed reproduces the challenge; the committed snapshot also survives generator revisions.
  return Array.from({ length: count }, (_, i) => {
    const p = story ? generateStoryProblem(config.tier, random) : generateArithmeticProblem(config, random);
    return normalizeQuestion({ ...p, id: `generated.${seed}.${i}`, domain: 'math', difficultyTier: config.tier,
      skill: story ? 'quantity_tracking' : 'arithmetic', category: story ? 'story' : 'arithmetic', question: p.prompt,
      explanation: p.explanation || `The correct answer is ${p.correctAnswer}. Check each operation in order.` });
  });
}
export function chooseCluster(state, tier, seed) {
  const exposure = state.memoryExposure || {};
  return shuffle(MEMORY_CONTENT, seed).sort((a, b) => (exposure[a.id] || 0) - (exposure[b.id] || 0) ||
    Math.abs(a.difficultyTier - tier) - Math.abs(b.difficultyTier - tier))[0];
}
