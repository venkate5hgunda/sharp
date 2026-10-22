import test from 'node:test';
import assert from 'node:assert/strict';
import { generateArithmeticProblem, generateStoryProblem } from '../js/content/math-generator.js';

test('generateArithmeticProblem generates solvable problem with 4 unique options', () => {
  const config = {
    tier: 2,
    operators: ['+', '-', '*'],
    maxNumber: 50,
    termsCount: 2
  };

  for (let i = 0; i < 20; i++) {
    const prob = generateArithmeticProblem(config);
    assert.ok(prob.prompt, 'Prompt should exist');
    assert.ok(typeof prob.correctAnswer === 'number', 'Correct answer should be numeric');
    assert.equal(prob.options.length, 4, 'Should have exactly 4 options');
    assert.ok(prob.options.includes(prob.correctAnswer), 'Options must include correct answer');
    const uniqueOptions = new Set(prob.options);
    assert.equal(uniqueOptions.size, 4, 'All 4 options must be distinct');
  }
});

test('generateStoryProblem generates valid story problem across tiers', () => {
  for (let tier = 1; tier <= 5; tier++) {
    const prob = generateStoryProblem(tier);
    assert.ok(prob.prompt.length > 20, 'Prompt should contain story description');
    assert.ok(typeof prob.correctAnswer === 'number', 'Answer must be numeric');
    assert.equal(prob.options.length, 4, 'Should contain 4 options');
    assert.ok(prob.options.includes(prob.correctAnswer), 'Options must include correct answer');
  }
});
