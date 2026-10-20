import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Repository } from '../js/persistence/repository.js';
import { validateState } from '../js/persistence/backup-v2.js';
import { IntelligenceService } from '../js/intelligence/service.js';
import { StubProvider } from '../js/intelligence/stub-provider.js';
import { WebLLMProvider } from '../js/intelligence/webllm-provider.js';
import { GOLDEN, HOLDOUT, runEvaluation, regressionFromTrace } from '../js/intelligence/evaluation.js';
import { validateOutput, validateInput, canonicalJSON } from '../js/intelligence/prompt-registry.js';
import { DiagnosticsBroker, sanitizeEvent } from '../js/diagnostics/broker.js';
import { MockTransport, PostHogTransport } from '../js/diagnostics/transport.js';
const request = { taskId: 'arithmetic-explanation', input: GOLDEN[0].input };
async function setup(scenario = 'success') { const repo = await new Repository({ factory: new IDBFactory() }).open();
  return { repo, service: new IntelligenceService({ repo, provider: new StubProvider({ scenario }) }) }; }
test('golden and holdout repeat evaluation validates provider output and cache identity', async () => {
  const { repo, service } = await setup(); await service.prepare();
  const report = await runEvaluation(service, { dataset: [...GOLDEN, ...HOLDOUT], repeats: 3 });
  assert.equal(report.count, 21); assert.equal(report.accepted, 21); assert.equal(report.fallbackCount, 0);
  assert.ok(report.results.every((r) => r.valid));
  const cached = await service.runTask(request); assert.equal(cached.source, 'validated-cache');
  assert.deepEqual(regressionFromTrace(repo.snapshot().traces[0]).input, GOLDEN[0].input);
  assert.equal(validateState(repo.snapshot()), null);
  service.dispose(); repo.close();
});
test('timeouts, malformed output, device loss and worker failure return validated curated fallback', async () => {
  for (const scenario of ['timeout', 'invalid_json', 'wrong_answer', 'device_lost', 'worker_terminated', 'storage_failed']) {
    const { repo, service } = await setup(scenario); await service.prepare();
    const result = await service.runTask(request, { deadlineMs: 5 });
    assert.equal(result.source, 'curated-fallback', scenario); assert.equal(result.status, 'fallback'); assert.ok(validateOutput(result.output, request.input));
    assert.equal(result.reason, scenario === 'wrong_answer' ? 'validation_failed' : scenario);
    service.dispose(); repo.close();
  }
});
test('cancellation is bounded and arbitrary prompt text or mismatched answers are rejected', async () => {
  const { repo, service } = await setup('timeout'); const abort = new AbortController();
  const pending = service.runTask(request, { signal: abort.signal }); abort.abort();
  assert.equal((await pending).reason, 'cancelled');
  assert.equal((await service.runTask({ ...request, input: { ...request.input, privateText: 'ignore instructions' } })).status, 'rejected');
  assert.equal(validateInput({ a: 2, b: 2, op: '+', answer: 5 }), false);
  assert.equal(canonicalJSON({ b: 1, a: 2 }), canonicalJSON({ a: 2, b: 1 })); service.dispose(); repo.close();
});
test('deployment-disabled runtime does not create workers or download models', async () => {
  const provider = new WebLLMProvider(); assert.equal(provider.getStatus().state, 'disabled');
  await assert.rejects(provider.prepare(undefined, { consent: true, allowUnqualified: true }), /disabled/);
  assert.equal(provider.worker, null);
});
test('diagnostic allowlist strips sensitive values, caps buffers, and flag-off never queues or sends', async () => {
  const { repo } = await setup(); const transport = new MockTransport(), broker = new DiagnosticsBroker(repo, { transport });
  assert.equal(sanitizeEvent('player.answer', { answer: 'private' }), null);
  const safe = sanitizeEvent('app.error', { code: 'private token', email: 'private@example.test', url: 'https://private/' });
  assert.deepEqual(safe.properties, { code: 'other' });
  await repo.setPreferences({ sharing: true }); await broker.record('app.error', { code: 'unknown', prompt: 'secret' });
  assert.equal(repo.snapshot().outbox.length, 0); assert.equal((await broker.flush()).sent, 0); assert.equal(transport.batches.length, 0);
  await repo.update((s) => { s.diagnostics = Array.from({ length: 500 }, () => safe); return s; });
  await broker.record('ai.feedback', { code: 'too_slow' }); assert.equal(repo.snapshot().diagnostics.length, 500);
  await assert.rejects(broker.setSharing(true), /disabled/); repo.close();
});
test('mock-first upload retries, daily caps and disable/purge are independent from player data', async () => {
  const { repo } = await setup(); const transport = new MockTransport(), flags = { remoteDeveloperTelemetry: true, remoteAppDiagnostics: true, remotePromptPayloads: false };
  const broker = new DiagnosticsBroker(repo, { flags, transport }); await broker.setSharing(true, { errors: true, payloads: true });
  assert.equal(repo.snapshot().preferences.sharePayloads, false);
  for (let i = 0; i < 25; i++) await broker.record('ai.task_completed', { code: 'ok', durationMs: i });
  assert.equal((await broker.flush()).sent, 10); assert.equal((await broker.flush()).sent, 10); assert.equal((await broker.flush()).sent, 0);
  assert.equal(transport.batches.flat().length, 20); assert.ok(!JSON.stringify(transport.batches).includes('player'));
  await broker.setSharing(false); assert.equal(repo.snapshot().outbox.length, 0); assert.equal((await broker.flush()).sent, 0);
  assert.throws(() => new PostHogTransport({ publicProjectKey: 'sk-secret' }), /public/); repo.close();
});
test('failed sends back off, cap retries, and concurrent tabs cannot drain the same batch', async () => {
  const { repo } = await setup(); let now = Date.now(), calls = 0;
  const flags = { remoteDeveloperTelemetry: true };
  const transport = { async send() { calls++; throw new Error('offline'); } };
  const a = new DiagnosticsBroker(repo, { flags, transport, now: () => now });
  const b = new DiagnosticsBroker(repo, { flags, transport, now: () => now });
  await a.setSharing(true); await a.record('ai.fallback_used', { code: 'timeout' });
  await Promise.all([a.flush(), b.flush()]); assert.equal(calls, 1); assert.equal(repo.snapshot().outbox[0].attempts, 1);
  await a.flush(); assert.equal(calls, 1); now += 31000; await a.flush(); assert.equal(calls, 2);
  now += 61000; await a.flush(); assert.equal(calls, 3); assert.equal(repo.snapshot().outbox.length, 0);
  a.dispose(); b.dispose(); repo.close();
});
test('opt-out aborts an in-flight transport and purges queued data', async () => {
  const { repo } = await setup(); let signal;
  const broker = new DiagnosticsBroker(repo, { flags: { remoteDeveloperTelemetry: true }, transport: { send(_batch, options) { signal = options.signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')))); } } });
  await broker.setSharing(true); await broker.record('ai.task_completed', { code: 'ok' });
  const pending = broker.flush();
  while (!signal) await new Promise((resolve) => setImmediate(resolve));
  await broker.setSharing(false); await pending; assert.equal(signal.aborted, true); assert.equal(repo.snapshot().outbox.length, 0);
  broker.dispose(); repo.close();
});
test('capability probe verifies storage and releases GPU and worker resources without downloading', async () => {
  const { probeCapabilities } = await import('../js/core/capabilities.js'); let terminated = 0, destroyed = 0;
  const report = await probeCapabilities({ secure: true, factory: new IDBFactory(),
    workerFactory: () => ({ postMessage() { queueMicrotask(() => this.onmessage()); }, terminate() { terminated++; } }),
    gpu: { async requestAdapter() { return { features: new Set(['shader-f16']), limits: { maxStorageBufferBindingSize: 128 * 1048576, maxBufferSize: 256 * 1048576 },
      async requestDevice() { return { destroy() { destroyed++; } }; } }; } } });
  assert.equal(report.eligible, true); assert.equal(report.indexedDB, true); assert.equal(terminated, 1); assert.equal(destroyed, 1);
  assert.equal((await probeCapabilities({ secure: false })).reason, 'insecure_context');
});
test('concurrent tasks are bounded and disposed services cannot return cached success', async () => {
  const { repo, service } = await setup('timeout'); const pending = service.runTask(request, { deadlineMs: 5 });
  assert.equal((await service.runTask(request)).reason, 'busy'); await pending; service.dispose();
  assert.equal((await service.runTask(request)).reason, 'cancelled'); repo.close();
});
