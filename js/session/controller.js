import { createId } from '../core/identity.js';
import { localDayKey } from '../core/calendar.js';
import { getGameConfig, ratingToTier } from '../adaptive-engine.js';
import { projectRatings, RATING_VERSION } from './metrics.js';
import { BASE_CONTENT, importedItems, selectQuestions, arithmeticItems, randomSource, shuffle } from './content.js';

export const CIRCUIT = ['pattern-flash', 'math-arithmetic', 'logic-deduction', 'comprehension-inference'];
export const LEASE_MS = 45000;
export const domainFor = (game) => game.includes('math') ? 'math' : game === 'logic-deduction' ? 'logic' : game === 'comprehension-inference' ? 'comprehension' : game === 'delayed-memory' ? 'memory' : 'focus';
export function eventTime(now = Date.now()) {
  return { timestamp: now, date: localDayKey(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offsetMinutes: new Date(now).getTimezoneOffset() };
}
function visualItems(game, config, seed) {
  const random = randomSource(seed);
  return Array.from({ length: game === 'pattern-flash' ? 2 : 5 }, (_, i) => {
    const size = game === 'pattern-flash' ? config.gridSize ** 2 : config.blockSize;
    const length = game === 'pattern-flash' ? Math.min(size - 1, config.gridSize + 1) : Math.min(8, config.startSpan + Math.floor(i / 2));
    const sequence = [];
    while (sequence.length < length) { const next = Math.floor(random() * size); if (game === 'pattern-flash' ? !sequence.includes(next) : next !== sequence.at(-1)) sequence.push(next); }
    return { id: `${seed}.${i}`, version: 1, tier: config.tier, skill: game === 'pattern-flash' ? 'pattern_reconstruction' : 'sequence_forward',
      size, sequence, gridSize: config.gridSize || 3, displayMs: config.displayMs || config.flashDurationMs,
      direction: 'forward', distractor: shuffle(Array.from({ length: size }, (_, n) => n), `${seed}.d.${i}`).slice(0, length) };
  });
}
export function buildRound(game, state, seed, options = {}) {
  const domain = domainFor(game), rating = projectRatings(state).ratings[domain];
  const config = getGameConfig(game, rating);
  let items;
  if (game === 'math-arithmetic') items = arithmeticItems(config, seed);
  else if (game === 'pattern-flash' || game === 'corsi-span') items = visualItems(game, config, seed);
  else items = selectQuestions([...BASE_CONTENT, ...importedItems(state.content)], { domain, tier: config.tier,
    count: game === 'comprehension-inference' ? 3 : game === 'story-math' ? 5 : 4,
    seed, attempts: state.attempts, skill: options.skill, category: options.category });
  if (!items.length) throw new Error('No matching items. Choose another skill or import a valid pack.');
  return { game, domain, tier: config.tier, items, position: 0, phase: 'intro',
    practice: !!options.practice || items.some((q) => q.origin === 'imported'), attempts: [], completed: false };
}
function owned(state, id, owner, now) {
  const session = state.sessions[id];
  if (!session || session.owner !== owner || session.leaseUntil < now) throw new Error('This session is open in another tab or its lease expired. Return to Today and resume it.');
  return session;
}
export class SessionController {
  constructor(repo, { owner = createId('tab'), previousOwner = null, now = () => Date.now() } = {}) { this.repo = repo; this.owner = owner; this.previousOwner = previousOwner; this.now = now; }
  async start(game = 'workout', options = {}) {
    const id = createId('session'), now = this.now();
    await this.repo.update((state) => {
      const games = game === 'workout' ? CIRCUIT : [game];
      state.sessions[id] = { id, kind: game, owner: this.owner, leaseUntil: now + LEASE_MS, status: 'active',
        createdAt: now, updatedAt: now, roundIndex: 0, practice: !!options.practice,
        rounds: games.map((g, i) => buildRound(g, state, `${id}.${i}`, options)) };
      if (game === 'workout') state.workouts[id] = { id, ...eventTime(now), practice: !!options.practice, completedAt: null };
      return state;
    });
    return id;
  }
  async claim(id, takeover = false) {
    const now = this.now();
    await this.repo.update((state) => {
      const s = state.sessions[id];
      if (!s || s.status !== 'active') throw new Error('This session is already completed or no longer available.');
      if (!takeover && s.owner !== this.owner && s.owner !== this.previousOwner && s.leaseUntil > now) throw new Error('Another tab is using this session. Close it, wait briefly, or choose Take over.');
      const round = s.rounds[s.roundIndex];
      if (round.pausedAt) {
        const elapsed = Math.max(0, now - round.pausedAt), key = round.wasHidden ? 'hiddenMs' : 'pausedMs';
        round.pendingTiming ||= {}; round.pendingTiming[key] = (round.pendingTiming[key] || 0) + elapsed; delete round.pausedAt;
      }
      s.owner = this.owner; s.leaseUntil = now + LEASE_MS; s.updatedAt = now; return state;
    });
  }
  async change(id, mutation) {
    const now = this.now();
    return this.repo.update((state) => { const s = owned(state, id, this.owner, now); mutation(s, state, now);
      s.updatedAt = now; s.leaseUntil = now + LEASE_MS; return state; });
  }
  async heartbeat(id) { return this.change(id, () => {}); }
  async release(id) { return this.repo.update((state) => { const s = state.sessions[id]; if (s?.owner === this.owner) s.leaseUntil = 0; return state; }); }
  async begin(id) { return this.change(id, (s) => { s.rounds[s.roundIndex].phase = 'question'; }); }
  async answer(id, response, timing = {}, expected = null) {
    return this.change(id, (s, state, now) => {
      if (expected && (expected.roundIndex !== s.roundIndex || expected.position !== s.rounds[s.roundIndex].position)) throw new Error('This response belongs to an earlier question.');
      const round = s.rounds[s.roundIndex], item = round.items[round.position];
      const attemptId = `${s.id}:${s.roundIndex}:${round.position}`;
      if (state.attempts[attemptId]) return; // Repeated callbacks and another stale render cannot double apply.
      if (round.phase !== 'question') throw new Error('This question is no longer accepting answers.');
      let score, scoring = 'binary-v1';
      if (round.game === 'pattern-flash') {
        if (!Array.isArray(response) || response.some((i) => !Number.isInteger(i) || i < 0 || i >= item.size) || new Set(response).size !== response.length) throw new Error('Invalid pattern response.');
        const hit = response.filter((i) => item.sequence.includes(i)).length;
        score = response.length ? 2 * hit / (response.length + item.sequence.length) : 0; scoring = 'pattern-f1-v1';
      } else if (round.game === 'corsi-span') {
        if (!Array.isArray(response) || response.length !== item.sequence.length || response.some((i) => !Number.isInteger(i) || i < 0 || i >= item.size)) throw new Error('Enter the whole sequence.');
        score = response.every((v, i) => v === item.sequence[i]) ? 1 : 0;
      } else {
        if (!item.options.some((o) => o.id === response)) throw new Error('Invalid option.');
        score = response === item.correctOptionId ? 1 : 0;
      }
      for (const key of ['activeMs', 'hiddenMs', 'readingMs', 'pausedMs']) if (!Number.isFinite(timing[key] ?? 0) || (timing[key] ?? 0) < 0) throw new Error('Invalid response timing.');
      state.attempts[attemptId] = { id: attemptId, sessionId: s.id, roundId: `${s.id}:${s.roundIndex}`, itemId: item.id,
        contentVersion: item.version, game: round.game, domain: round.domain, skill: item.skill, tier: item.tier,
        response, score, scoring, activeMs: Math.round(timing.activeMs || 0), hiddenMs: Math.round(timing.hiddenMs || 0),
        readingMs: Math.round(timing.readingMs || 0), pausedMs: Math.round(timing.pausedMs || 0), practice: round.practice, interrupted: false,
        inputMode: ['pointer', 'keyboard', 'mixed'].includes(timing.inputMode) ? timing.inputMode : 'unknown', timingPolicy: 'active-v1',
        presentation: ['pattern-flash', 'corsi-span'].includes(round.game) ? 'visual' : 'single-choice',
        selectionReason: item.selectionReason || 'stored procedural stimulus', ...eventTime(now) };
      round.attempts.push(attemptId); round.phase = 'feedback'; delete round.pendingTiming;
    });
  }
  async next(id) {
    return this.change(id, (s, state, now) => {
      const round = s.rounds[s.roundIndex];
      if (round.phase === 'summary') return;
      if (round.phase !== 'feedback') throw new Error('Answer the question before continuing.');
      round.position++;
      if (round.position < round.items.length) { round.phase = 'question'; return; }
      const id = `${s.id}:${s.roundIndex}`;
      if (!state.rounds[id]) {
        const attempts = round.attempts.map((a) => state.attempts[a]);
        const eligible = attempts.filter((a) => !a.interrupted);
        state.rounds[id] = { id, sessionId: s.id, game: round.game, domain: round.domain, tier: Math.round(eligible.reduce((sum, a) => sum + a.tier, 0) / (eligible.length || 1)),
          score: eligible.reduce((sum, a) => sum + a.score, 0), count: eligible.length,
          latencyMs: eligible.reduce((sum, a) => sum + a.activeMs, 0) / (eligible.length || 1), expectedMs: round.game.includes('math') ? 4500 : 18000,
          practice: round.practice, ratingVersion: RATING_VERSION, ...eventTime(now) };
      }
      round.phase = 'summary'; round.completed = true;
      if (s.roundIndex === s.rounds.length - 1) {
        s.status = 'completed'; s.completedAt = now;
        if (state.workouts[s.id]) state.workouts[s.id].completedAt = now;
        if (s.memoryId && state.memory?.id === s.memoryId) {
          state.memory.status = 'completed'; state.memory.completedAt = now;
          state.memoryHistory ||= [];
          state.memoryHistory.push({ id: state.memory.id, actualDelayMs: s.actualDelayMs, mode: 'recognition',
            bucket: s.actualDelayMs < 3600000 ? 'fast-track' : s.actualDelayMs < 86400000 ? 'same-day' : 'longer-delay',
            practice: round.practice, sessionId: s.id, ...eventTime(now) });
        }
      }
    });
  }
  async nextRound(id) { return this.change(id, (s) => {
    if (!s.rounds[s.roundIndex].completed || s.roundIndex >= s.rounds.length - 1) return;
    s.roundIndex++; s.rounds[s.roundIndex].phase = 'intro';
  }); }
  async interrupt(id, timing = null, hidden = false) { return this.change(id, (s, state, now) => {
    const round = s.rounds[s.roundIndex];
    if (round.phase === 'question') {
      if (timing) round.pendingTiming = timing;
      round.pausedAt ||= now; round.wasHidden = hidden;
      s.interruptionCount = (s.interruptionCount || 0) + 1;
    }
    // Timed exposure cannot continue fairly after suspension; replay the same unscored stimulus.
    if (['pattern-flash', 'corsi-span'].includes(round.game) && round.phase === 'question') round.phase = 'intro';
  }); }
  async recallMemory() {
    const id = createId('session'), now = this.now(); let selected = id;
    await this.repo.update((state) => {
      const memory = state.memory;
      if (!memory || memory.status !== 'committed' || memory.readyAt > now) throw new Error('This study set is not ready for recall yet.');
      if (memory.recallSessionId) { selected = memory.recallSessionId; return state; }
      const words = shuffle([...memory.items.map((item) => ({ word: item.word, target: true })),
        ...(memory.foils || []).map((item) => ({ word: item.word, target: false }))], memory.id);
      const items = words.map((item, i) => ({ id: `${memory.id}.recognition.${i}`, version: 1, schemaVersion: 2,
        domain: 'memory', skill: 'recognition', tier: memory.tier || 2, category: 'retention', locale: 'en', title: 'Time-capsule recall',
        prompt: `Was “${item.word}” in your study set?`, question: `Was “${item.word}” in your study set?`,
        options: [{ id: 'yes', text: 'Yes, I studied it' }, { id: 'no', text: 'No, it is a foil' }],
        correctOptionId: item.target ? 'yes' : 'no', explanation: item.target ? `${item.word} was part of the original study set.` : `${item.word} was a foil; it was not in the original study set.`,
        origin: 'curated', validation: 'study-snapshot', target: item.target }));
      const practice = memory.type === 'quick_timer' || !!memory.freeRecallPractised || !memory.foils?.length;
      state.sessions[id] = { id, kind: 'delayed-memory', status: 'active', owner: this.owner, leaseUntil: now + LEASE_MS,
        createdAt: now, updatedAt: now, roundIndex: 0, memoryId: memory.id, actualDelayMs: now - memory.createdAt,
        rounds: [{ game: 'delayed-memory', domain: 'memory', tier: memory.tier || 2, items, position: 0, phase: 'intro', practice, attempts: [], completed: false }] };
      memory.recallSessionId = id; return state;
    });
    return selected;
  }
}
