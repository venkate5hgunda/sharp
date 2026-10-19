export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const isRecord = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

export function isSafeData(value, depth = 0, seen = new Set()) {
  if (depth > 20) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 50000 && !/<\/?[a-z!][^>]*>|<!--/i.test(value);
  if ((!isRecord(value) && !Array.isArray(value)) || seen.has(value)) return false;
  seen.add(value);
  const valid = Object.entries(value).every(([key, child]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && isSafeData(child, depth + 1, seen));
  seen.delete(value);
  return valid;
}

export function validateQuestion(question) {
  const fail = (error) => ({ valid: false, error });
  if (!isRecord(question) || !isSafeData(question)) return fail('Unsafe or invalid question data. Use plain text.');
  if (typeof question.id !== 'string' || !/^[\w.-]{1,160}$/.test(question.id) ||
      ['__proto__', 'constructor', 'prototype'].includes(question.id)) return fail('Invalid question ID.');
  if (!['math', 'logic', 'comprehension'].includes(question.domain)) return fail('Unsupported question domain.');
  for (const key of ['question', 'category', 'skill', 'explanation']) {
    if (typeof question[key] !== 'string' || !question[key].trim()) return fail(`Missing ${key}.`);
  }
  if (!Number.isInteger(question.difficultyTier) || question.difficultyTier < 1 || question.difficultyTier > 7) {
    return fail('Difficulty tier must be an integer from 1 to 7.');
  }
  const { options, correctAnswer } = question;
  if (!Array.isArray(options) || options.length < 2 || options.length > 4 ||
      options.some((option) => question.domain === 'math' ? typeof option !== 'number' : typeof option !== 'string' || !option.trim()) ||
      new Set(options).size !== options.length || !options.includes(correctAnswer)) {
    return fail('Provide 2–4 unique options containing the correct answer.');
  }
  if (question.domain === 'logic' && (!Array.isArray(question.premises) || !question.premises.length ||
      question.premises.some((premise) => typeof premise !== 'string' || !premise.trim()))) return fail('Logic questions need premises.');
  for (const key of question.domain === 'comprehension' ? ['title', 'passage'] : question.domain === 'math' ? ['prompt'] : []) {
    if (typeof question[key] !== 'string' || !question[key].trim()) return fail(`Missing ${key}.`);
  }
  return { valid: true };
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
