import { FEATURES } from '../core/feature-flags.js';
import { createId } from '../core/identity.js';
import { digest } from '../persistence/repository.js';
import { PROMPTS, canonicalJSON, validateInput, validateOutput, fallback } from './prompt-registry.js';
import { StubProvider } from './stub-provider.js';
export class IntelligenceService {
  constructor({ repo, provider = new StubProvider(), broker, now = () => performance.now() } = {}) {
    this.repo = repo; this.provider = provider; this.broker = broker; this.now = now; this.active = new Map();
  }
  getStatus() { return this.provider.getStatus(); }
  async prepare(profile, options = {}) { return this.provider.prepare(profile, options); }
  async key(request, prompt) {
    return digest(canonicalJSON({ task: request.taskId, prompt, artifact: this.provider.identity, decoding: { temperature: 0, maxTokens: prompt.maxTokens }, locale: 'en', input: request.input }));
  }
  async runTask(request, options = {}) {
    const prompt = PROMPTS[request.taskId];
    if (!prompt || !validateInput(request.input)) return { status: 'rejected', source: 'curated-fallback', reason: 'invalid_input', output: null };
    if (this.disposed || this.active.size) return { status: 'fallback', source: 'curated-fallback', reason: this.disposed ? 'cancelled' : 'busy', output: fallback(request.input) };
    const requestId = request.requestId || createId('request'), started = this.now();
    const deadline = Math.max(1, Math.min(10000, options.deadlineMs || 10000));
    const controller = new AbortController(); this.active.set(requestId, controller);
    let timedOut = false;
    let timer, removeAbort = () => {}, source = 'curated-fallback', reason = null, output = fallback(request.input), status = 'fallback';
    try {
      const key = await this.key(request, prompt), cached = this.repo?.snapshot().resultCache?.[key];
      if (this.disposed || options.signal?.aborted) throw new Error('cancelled');
      if (!options.bypassCache && cached && cached.expiresAt > Date.now() && validateOutput(cached.output, request.input)) {
        source = 'validated-cache'; output = cached.output; status = 'success';
      } else {
        const cancel = () => { controller.abort(); this.provider.cancel(requestId); };
        options.signal?.addEventListener('abort', cancel, { once: true }); removeAbort = () => options.signal?.removeEventListener('abort', cancel);
        if (options.signal?.aborted) cancel();
        const task = { ...request, requestId, promptVersion: prompt.version, outputSchemaVersion: prompt.schemaVersion };
        const raw = await Promise.race([
          this.provider.runTask(task, { signal: controller.signal, prompt }),
          new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; cancel(); reject(new Error('timeout')); }, deadline); controller.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); })
        ]);
        let parsed = raw; if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch { throw new Error('invalid_json'); } }
        if (!validateOutput(parsed, request.input)) throw new Error('validation_failed');
        output = parsed; source = this.provider instanceof StubProvider ? 'stub' : 'model'; status = 'success';
        if (this.repo) await this.repo.update((s) => {
          s.resultCache ||= {}; s.resultCache[key] = { output, createdAt: Date.now(), expiresAt: Date.now() + 7 * 86400000 };
          const keys = Object.keys(s.resultCache).sort((a, b) => s.resultCache[b].createdAt - s.resultCache[a].createdAt);
          keys.slice(100).forEach((k) => delete s.resultCache[k]); return s;
        }).catch(() => {});
      }
    } catch (error) {
      reason = timedOut ? 'timeout' : ['timeout', 'cancelled', 'invalid_json', 'validation_failed', 'device_lost', 'worker_terminated', 'storage_failed', 'disabled', 'not_ready'].includes(error.message) ? error.message : 'provider_error';
    } finally { clearTimeout(timer); removeAbort(); this.active.delete(requestId); }
    const result = { requestId, status, source, reason, output, timings: { totalMs: Math.round(this.now() - started), ...(source === 'model' ? this.provider.lastTimings : {}) },
      taskId: request.taskId, promptVersion: prompt.version, validatorVersion: prompt.validatorVersion, artifact: this.provider.identity };
    if (this.repo) await this.repo.update((s) => {
      const { output: acceptedOutput, ...metadata } = result;
      s.traces.push({ ...metadata, ...(options.captureLocalPayload ? { fixtureInput: request.input } : {}), timestamp: Date.now() }); s.traces = s.traces.slice(-100); return s;
    }).catch(() => {});
    await this.broker?.record(status === 'success' ? 'ai.task_completed' : 'ai.fallback_used', { code: reason || 'ok', durationMs: result.timings.totalMs, source });
    return result;
  }
  cancel(requestId) { this.active.get(requestId)?.abort(); this.provider.cancel(requestId); }
  dispose() { this.disposed = true; for (const id of this.active.keys()) this.cancel(id); this.provider.dispose(); }
}
export async function createIntelligenceService(options = {}) {
  if (!FEATURES.browserInference) return new IntelligenceService(options);
  const { WebLLMProvider } = await import('./webllm-provider.js');
  return new IntelligenceService({ ...options, provider: new WebLLMProvider() });
}
