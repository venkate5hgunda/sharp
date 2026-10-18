// Games Catalog for Sharp — Central registry of cognitive exercises
import { DOMAINS } from '../adaptive-engine.js';

export const CATALOG = [
  {
    id: 'delayed-memory',
    title: 'Time-Capsule Recall',
    domain: DOMAINS.MEMORY,
    badge: 'Morning / Evening Protocol',
    icon: 'hourglass',
    summary: 'Study items in the morning and recall them in the evening to measure and train real-world retention.',
    description: 'Scientifically calibrated to train long-term memory consolidation. Items are introduced early in the day, then recalled after an interference period to track your forgetting curve.',
    timeEstimate: '2–3 mins'
  },
  {
    id: 'pattern-flash',
    title: 'Pattern & Interference',
    domain: DOMAINS.FOCUS,
    badge: 'Interference Resistance',
    icon: 'grid',
    summary: 'Memorize visual patterns, resist confusing distractor flashes, and reconstruct the originals from memory.',
    description: 'Trains visual working memory under cognitive interference. After viewing target patterns, an active distractor phase attempts to disrupt your mental buffer before recall.',
    timeEstimate: '3 mins'
  },
  {
    id: 'math-arithmetic',
    title: 'Mental Arithmetic',
    domain: DOMAINS.MATH,
    badge: 'Speed & Precision',
    icon: 'calculator',
    summary: 'Adaptive calculations spanning addition, subtraction, multiplication, division, and multi-step operations.',
    description: 'Dynamic arithmetic engine adjusting in real-time to your speed and accuracy. Scales from basic operations to complex multi-term mental math.',
    timeEstimate: '2–3 mins'
  },
  {
    id: 'story-math',
    title: 'Story Math & Comprehension',
    domain: DOMAINS.MATH,
    badge: 'Word Problems',
    icon: 'book-open',
    summary: 'Translate descriptive story situations into mathematical solutions through progressive multi-step logic.',
    description: 'Engaging real-world scenarios ("Jack gave Jill X, then bought Y..."). Combines reading comprehension, variable tracking, and quantitative calculation.',
    timeEstimate: '3–4 mins'
  },
  {
    id: 'logic-deduction',
    title: 'Deductive Syllogisms',
    domain: DOMAINS.LOGIC,
    badge: 'Formal Reasoning',
    icon: 'git-commit',
    summary: 'Analyze premises, evaluate syllogisms, and separate valid deductions from persuasive fallacies.',
    description: 'Strengthens logical deduction and analytical thinking. Test whether conclusions strictly follow from categorical and conditional premises.',
    timeEstimate: '3 mins'
  },
  {
    id: 'comprehension-inference',
    title: 'Speed Inference',
    domain: DOMAINS.COMPREHENSION,
    badge: 'Critical Reading',
    icon: 'file-text',
    summary: 'Read concise analytical passages and deduce unstated logical implications under light time pressure.',
    description: 'Sharpens verbal reasoning and rapid information extraction. Determine which claims must logically hold and identify hidden assumptions.',
    timeEstimate: '3 mins'
  },
  {
    id: 'corsi-span',
    title: 'Spatial Corsi Span',
    domain: DOMAINS.FOCUS,
    badge: 'Working Memory',
    icon: 'layers',
    summary: 'Classic neuroscience spatial memory task. Watch a sequence of blocks illuminate, then repeat in order.',
    description: 'Measures and expands your visuospatial sketchpad capacity. Forward and reverse sequences scale continuously with your performance.',
    timeEstimate: '2–3 mins'
  }
];

export function getGameById(id) {
  return CATALOG.find((g) => g.id === id);
}

export function getGamesByDomain(domain) {
  return CATALOG.filter((g) => g.domain === domain);
}
