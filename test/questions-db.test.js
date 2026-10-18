import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllQuestions,
  getQuestionsByDomain,
  getQuestionById,
  getMemoryCluster,
  exportHydratedDataset,
  getDatasetStats,
  importQuestionPack
} from '../data/questions-db.js';

test('getAllQuestions returns unified dataset with valid schemas', () => {
  const all = getAllQuestions();
  assert.ok(all.length >= 20, 'Should have at least 20 baseline curated questions');

  all.forEach((q) => {
    assert.ok(q.id, `Question ${q.id} must have an ID`);
    assert.ok(q.domain, `Question ${q.id} must have a domain`);
    assert.ok(q.category, `Question ${q.id} must have a category`);
    assert.ok(q.question || q.prompt, `Question ${q.id} must have a question or prompt`);
    assert.ok(q.correctAnswer !== undefined, `Question ${q.id} must have a correct answer`);
    assert.ok(Array.isArray(q.options), `Question ${q.id} options must be an array`);
    assert.ok(q.options.length >= 2, `Question ${q.id} must have at least 2 options`);
    assert.ok(q.options.includes(q.correctAnswer), `Question ${q.id} options must include correctAnswer`);
    assert.ok(q.explanation, `Question ${q.id} must provide an educational explanation`);
    assert.ok(q.metadata, `Question ${q.id} must contain metadata for hydration`);
  });
});

test('getQuestionsByDomain filters properly by domain and tier', () => {
  const logicQuestions = getQuestionsByDomain('logic', 2, 3);
  assert.equal(logicQuestions.length, 3);
  logicQuestions.forEach((q) => {
    assert.equal(q.domain, 'logic');
  });

  const mathQuestions = getQuestionsByDomain('math', 3, 2);
  assert.equal(mathQuestions.length, 2);
  mathQuestions.forEach((q) => {
    assert.equal(q.domain, 'math');
  });
});

test('getMemoryCluster returns themed cluster with targets and distractor foils', () => {
  const cluster = getMemoryCluster(2);
  assert.ok(cluster.title, 'Cluster should have a title');
  assert.ok(cluster.targetItems.length >= 5, 'Cluster should have at least 5 target items');
  assert.ok(cluster.distractorFoils.length >= 4, 'Cluster should provide distractor foils');

  cluster.targetItems.forEach((item) => {
    assert.ok(item.word, 'Item must have a word');
    assert.ok(item.cue, 'Item must have a mnemonic cue');
    assert.ok(item.category, 'Item must have a category');
  });
});

test('exportHydratedDataset exports valid comprehensive payload', () => {
  const exported = exportHydratedDataset();
  assert.equal(exported.appName, 'sharp');
  assert.ok(exported.totalQuestions >= 20);
  assert.ok(Array.isArray(exported.questions));
  assert.ok(Array.isArray(exported.memoryClusters));
});

test('importQuestionPack validates and ingests valid questions', () => {
  const samplePack = [
    {
      id: 'custom_test_001',
      domain: 'logic',
      category: 'syllogisms',
      skill: 'test_skill',
      difficultyTier: 2,
      question: 'Is this a valid test?',
      options: ['Yes', 'No'],
      correctAnswer: 'Yes',
      explanation: 'Test explanation'
    }
  ];

  const res = importQuestionPack(samplePack);
  assert.ok(res.success);
  assert.equal(res.importedCount, 1);

  const retrieved = getQuestionById('custom_test_001');
  assert.ok(retrieved);
  assert.equal(retrieved.question, 'Is this a valid test?');
});
