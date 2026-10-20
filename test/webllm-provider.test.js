import test from 'node:test';
import assert from 'node:assert/strict';
import { WebLLMProvider } from '../js/intelligence/webllm-provider.js';
import { MODEL_PROFILE } from '../js/intelligence/model-manifest.js';
import { IntelligenceService } from '../js/intelligence/service.js';
import { GOLDEN } from '../js/intelligence/evaluation.js';

const choice = { consent: true, allowUnqualified: true };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
function setup(overrides = {}, preparationTimeoutMs = 100) {
  const resources = { workers: [], cacheSignals: [] };
  const dependencies = {
    probe: async () => ({ eligible: true }),
    cacheRuntime: async (signal) => { resources.cacheSignals.push(signal); },
    loadSDK: async () => ({ CreateWebWorkerMLCEngine: async () => ({}) }),
    createWorker: () => { const worker = { terminated: false, terminate() { this.terminated = true; } }; resources.workers.push(worker); return worker; },
    ...overrides
  };
  return { provider: new WebLLMProvider({ enabled: true, dependencies, preparationTimeoutMs }), resources };
}

test('preparation deadline covers probes, runtime downloads, SDK imports and worker loading', async () => {
  for (const phase of ['probe', 'cacheRuntime', 'loadSDK', 'engine']) {
    const stalled = deferred();
    const overrides = phase === 'engine' ? { loadSDK: async () => ({ CreateWebWorkerMLCEngine: () => stalled.promise }) }
      : { [phase]: () => stalled.promise };
    const { provider, resources } = setup(overrides, 10);
    await assert.rejects(provider.prepare(MODEL_PROFILE, choice), /timeout/, phase);
    assert.equal(provider.getStatus().state, 'recoverable_error');
    assert.ok(resources.workers.every((w) => w.terminated));
    assert.ok(resources.cacheSignals.every((signal) => signal.aborted));
    provider.dispose();
  }
});

test('cancellation rejects a stalled import and its late completion cannot start a worker', async () => {
  const imported = deferred(), reached = deferred(), abort = new AbortController();
  const { provider, resources } = setup({ loadSDK: () => { reached.resolve(); return imported.promise; } });
  const pending = provider.prepare(MODEL_PROFILE, { ...choice, signal: abort.signal });
  await reached.promise; abort.abort(); await assert.rejects(pending, /cancelled/);
  imported.resolve({ CreateWebWorkerMLCEngine: async () => ({}) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resources.workers.length, 0); assert.equal(provider.engine, null);
  provider.dispose();
});

test('concurrent preparation is rejected and dispose stops loading without late ready state', async () => {
  const loading = deferred(), reached = deferred(); let progress;
  const { provider, resources } = setup({ loadSDK: async () => ({ CreateWebWorkerMLCEngine(_worker, _model, options) {
    progress = options.initProgressCallback; reached.resolve(); return loading.promise;
  } }) });
  const pending = provider.prepare(MODEL_PROFILE, choice); await reached.promise;
  await assert.rejects(provider.prepare(MODEL_PROFILE, choice), /busy/);
  provider.dispose(); await assert.rejects(pending, /cancelled/);
  loading.resolve({}); progress({ progress: 1, text: 'late' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(resources.workers[0].terminated); assert.equal(provider.engine, null);
  assert.notEqual(provider.state, 'ready');
});

test('successful preparation retains its engine and worker errors terminate failed preparations', async () => {
  const { provider, resources } = setup();
  const report = await provider.prepare(MODEL_PROFILE, choice);
  assert.equal(report.state, 'ready'); assert.ok(provider.engine); assert.equal(resources.workers[0].terminated, false);
  provider.dispose(); assert.equal(resources.workers[0].terminated, true);
  const failed = setup({ loadSDK: async () => ({ CreateWebWorkerMLCEngine(worker) {
    queueMicrotask(() => worker.onerror()); return new Promise(() => {});
  } }) });
  await assert.rejects(failed.provider.prepare(MODEL_PROFILE, choice), /worker_terminated/);
  assert.equal(failed.resources.workers[0].terminated, true); failed.provider.dispose();
});

test('task timeout tears down the generating worker and returns curated fallback', async () => {
  const { provider, resources } = setup({ loadSDK: async () => ({ CreateWebWorkerMLCEngine: async () => ({
    chat: { completions: { create: () => new Promise(() => {}) } }
  }) }) });
  await provider.prepare(MODEL_PROFILE, choice);
  const service = new IntelligenceService({ provider });
  const result = await service.runTask({ taskId: 'arithmetic-explanation', input: GOLDEN[0].input }, { deadlineMs: 10 });
  assert.equal(result.reason, 'timeout'); assert.equal(result.source, 'curated-fallback');
  assert.equal(resources.workers[0].terminated, true); assert.equal(provider.engine, null);
  assert.equal((await service.runTask({ taskId: 'arithmetic-explanation', input: GOLDEN[0].input })).reason, 'not_ready');
  service.dispose();
});
