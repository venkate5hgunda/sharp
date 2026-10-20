import { isRecord } from '../content-validation.js';
export const PROMPTS = Object.freeze({
  'arithmetic-explanation': Object.freeze({ version: '1.0.0', schemaVersion: 'arithmetic-format-v1', validatorVersion: 'exact-arithmetic-v1',
    system: 'Return only JSON with answer (number) and style ("concise" or "steps"). The input contains a verified arithmetic operation. Recompute it. Do not change operands or add other fields. No tools are available.',
    maxTokens: 128, temperature: 0, contextTokens: 1024,
    schema: { type: 'object', additionalProperties: false, required: ['answer', 'style'], properties: { answer: { type: 'number' }, style: { enum: ['concise', 'steps'] } } }
  })
});
export function validateInput(input) {
  if (!isRecord(input) || Object.keys(input).some((k) => !['a', 'b', 'op', 'answer'].includes(k)) ||
    !['+', '-', '*'].includes(input.op) || ![input.a, input.b, input.answer].every(Number.isSafeInteger) || Math.abs(input.a) > 1000000 || Math.abs(input.b) > 1000000) return false;
  return compute(input) === input.answer;
}
export function compute({ a, b, op }) { return op === '+' ? a + b : op === '-' ? a - b : a * b; }
export function validateOutput(output, input) {
  return validateInput(input) && isRecord(output) && Object.keys(output).length === 2 &&
    ['concise', 'steps'].includes(output.style) && output.answer === compute(input);
}
export function fallback(input) { return { answer: compute(input), style: 'steps' }; }
export function explanation(input, output) {
  if (!validateOutput(output, input)) throw new Error('Unvalidated explanation.');
  const operation = { '+': 'add', '-': 'subtract', '*': 'multiply' }[input.op];
  return output.style === 'concise' ? `${input.a} ${input.op} ${input.b} = ${output.answer}.` : `Use ${operation} on ${input.a} and ${input.b}. The result is ${output.answer}.`;
}
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
