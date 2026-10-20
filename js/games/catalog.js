// Games Catalog for Sharp — Central registry of cognitive exercises
import { DOMAINS } from '../adaptive-engine.js';

export const CATALOG = [
  {
    id: 'delayed-memory',
    title: 'Memory Recall',
    domain: DOMAINS.MEMORY,
    badge: 'Morning / Evening Protocol',
    icon: 'hourglass',
    summary: 'Study words now. Recall them later.',
    description: 'Study words now. Recall them later.',
    timeEstimate: '2–3 mins'
  },
  {
    id: 'pattern-flash',
    title: 'Pattern Memory',
    domain: DOMAINS.FOCUS,
    badge: 'Interference Resistance',
    icon: 'grid',
    summary: 'Remember a pattern. Rebuild it.',
    description: 'Remember a pattern. Rebuild it.',
    timeEstimate: '3 mins'
  },
  {
    id: 'math-arithmetic',
    title: 'Mental Math',
    domain: DOMAINS.MATH,
    badge: 'Speed & Precision',
    icon: 'calculator',
    summary: 'Quick calculations at your level.',
    description: 'Quick calculations at your level.',
    timeEstimate: '2–3 mins'
  },
  {
    id: 'story-math',
    title: 'Story Math',
    domain: DOMAINS.MATH,
    badge: 'Word Problems',
    icon: 'book-open',
    summary: 'Solve everyday word problems.',
    description: 'Solve everyday word problems.',
    timeEstimate: '3–4 mins'
  },
  {
    id: 'logic-deduction',
    title: 'Logic',
    domain: DOMAINS.LOGIC,
    badge: 'Formal Reasoning',
    icon: 'git-commit',
    summary: 'Find what follows from the facts.',
    description: 'Find what follows from the facts.',
    timeEstimate: '3 mins'
  },
  {
    id: 'comprehension-inference',
    title: 'Reading',
    domain: DOMAINS.COMPREHENSION,
    badge: 'Critical Reading',
    icon: 'file-text',
    summary: 'Read a passage. Find the evidence.',
    description: 'Read a passage. Find the evidence.',
    timeEstimate: '3 mins'
  },
  {
    id: 'corsi-span',
    title: 'Sequence Memory',
    domain: DOMAINS.FOCUS,
    badge: 'Working Memory',
    icon: 'layers',
    summary: 'Watch the blocks. Repeat the order.',
    description: 'Watch the blocks. Repeat the order.',
    timeEstimate: '2–3 mins'
  }
];

export function getGameById(id) {
  return CATALOG.find((g) => g.id === id);
}

export function getGamesByDomain(domain) {
  return CATALOG.filter((g) => g.domain === domain);
}
