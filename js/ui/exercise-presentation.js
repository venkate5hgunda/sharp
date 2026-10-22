// Small shared visual vocabulary; all labels remain readable without the icons.
export const skillLabel = (domain) =>
  ({ focus: 'Memory', memory: 'Memory', math: 'Math', logic: 'Logic', comprehension: 'Reading' })[
    domain
  ] || domain;
export const exerciseGuide = (game) =>
  ({
    'pattern-flash': 'Remember the first pattern. After it disappears, tap the same squares.',
    'corsi-span': 'Watch the squares light up. Then tap them in the same order.',
    'math-arithmetic': 'Solve each calculation and choose your answer.',
    'story-math': 'Read a short problem and choose your answer.',
    'logic-deduction': 'Read the facts. Choose what must be true.',
    'comprehension-inference': 'Read a short passage, then answer a question about it.',
  })[game] || 'Study the words. See what you remember later.';
export function exerciseIcon(game) {
  const paths = {
    'pattern-flash':
      '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    'math-arithmetic': '<path d="M5 8h8M9 4v8M15 16h6M15 20h6"/>',
    'story-math': '<path d="M4 4h7v16H4zM11 7h9v13h-9M6 8h3M14 11h3M14 15h3"/>',
    'logic-deduction': '<path d="m12 3 8 9-8 9-8-9 8-9zM8 12h8M12 8v8"/>',
    'comprehension-inference': '<path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4V5zM12 7v14"/>',
    'corsi-span': '<path d="M5 5h5v5H5zM14 14h5v5h-5zM7 14v4h3M14 7h4v3"/>',
    'delayed-memory': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[game] || paths['pattern-flash']}</svg>`;
}
