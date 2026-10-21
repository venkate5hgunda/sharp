import test from 'node:test';
import assert from 'node:assert/strict';
import { CPU_PROFILE } from '../scripts/cpu-profile.mjs';
import { checkCPUReport } from '../scripts/run-cpu-evals.mjs';
import { checkModelReport } from '../js/intelligence/evaluation-quality.js';
test('CPU artifacts are immutable and explicitly disable GPU offloading', () => {
  assert.match(CPU_PROFILE.modelURL, /resolve\/[a-f0-9]{40}\//); assert.match(CPU_PROFILE.runtimeURL, /download\/b11799\//);
  assert.match(CPU_PROFILE.modelSHA256, /^[a-f0-9]{64}$/); assert.match(CPU_PROFILE.runtimeSHA256, /^[a-f0-9]{64}$/); assert.equal(CPU_PROFILE.gpuLayers, 0);
});
test('CPU results cannot be recorded as browser-GPU release evidence', () => {
  const report = { version: 'sharp-cpu-eval-v1', backend: 'cpu', profile: CPU_PROFILE };
  assert.throws(() => checkModelReport(report, {}), /browser report/);
  assert.throws(() => checkCPUReport({ ...report, backend: 'gpu' }, {}), /CPU model evidence/);
});
