import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRatingDelta,
  ratingToTier,
  getTierLabel,
  getOverallSharpScore,
  getGameConfig,
  DEFAULT_RATINGS
} from '../js/adaptive-engine.js';

test('ratingToTier converts rating ranges correctly', () => {
  assert.equal(ratingToTier(800), 1);
  assert.equal(ratingToTier(949), 1);
  assert.equal(ratingToTier(950), 2);
  assert.equal(ratingToTier(1099), 2);
  assert.equal(ratingToTier(1100), 3);
  assert.equal(ratingToTier(1249), 3);
  assert.equal(ratingToTier(1250), 4);
  assert.equal(ratingToTier(1399), 4);
  assert.equal(ratingToTier(1400), 5);
  assert.equal(ratingToTier(1599), 5);
  assert.equal(ratingToTier(1600), 6);
  assert.equal(ratingToTier(1849), 6);
  assert.equal(ratingToTier(1850), 7);
});

test('getTierLabel returns human-readable tier names', () => {
  assert.equal(getTierLabel(1), 'Foundational');
  assert.equal(getTierLabel(2), 'Novice');
  assert.equal(getTierLabel(3), 'Intermediate');
  assert.equal(getTierLabel(4), 'Proficient');
  assert.equal(getTierLabel(5), 'Advanced');
  assert.equal(getTierLabel(6), 'Expert');
  assert.equal(getTierLabel(7), 'Master');
});

test('getOverallSharpScore calculates balanced average', () => {
  const ratings = {
    memory: 1100,
    math: 1200,
    logic: 1000,
    comprehension: 1050,
    focus: 950
  };
  assert.equal(getOverallSharpScore(ratings), 1060);
});

test('calculateRatingDelta rewards high accuracy and fast speed', () => {
  const currentRating = 1000;
  const tier = 2; // benchmark ~1050
  const highAccuracy = 1.0;
  const fastLatency = 2000; // faster than expected 4000ms

  const res = calculateRatingDelta(currentRating, tier, highAccuracy, fastLatency, 4000);
  assert.ok(res.delta > 0, 'Delta should be positive for 100% accuracy');
  assert.ok(res.newRating > currentRating, 'New rating should be higher');
});

test('calculateRatingDelta gently decreases on low accuracy', () => {
  const currentRating = 1200;
  const tier = 1;
  const lowAccuracy = 0.2;
  const slowLatency = 7000;

  const res = calculateRatingDelta(currentRating, tier, lowAccuracy, slowLatency, 4000);
  assert.ok(res.delta < 0, 'Delta should be negative for poor accuracy');
  assert.ok(res.newRating < currentRating, 'Rating should decrease');
});

test('getGameConfig tunes parameters according to player rating', () => {
  const configTier1 = getGameConfig('math-arithmetic', 850);
  const configTier5 = getGameConfig('math-arithmetic', 1500);

  assert.equal(configTier1.tier, 1);
  assert.equal(configTier5.tier, 5);
  assert.ok(configTier5.maxNumber > configTier1.maxNumber);
  assert.ok(configTier5.operators.length > configTier1.operators.length);
});
