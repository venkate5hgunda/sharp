import { FEATURES } from '../core/feature-flags.js';
import { MODEL_PROFILE, modelAppConfig } from './model-manifest.js';
import { probeCapabilities } from '../core/capabilities.js';
const runtimeDependencies = {
  probe: probeCapabilities,
  async cacheRuntime(signal) {
    if (!('caches' in globalThis)) return;
    const scope = new URL('../../', import.meta.url).href;
    const cache = await caches.open(`sharp:models:runtime:${scope}:0.2.86`);
    await cache.addAll(['client', 'worker'].map((name) => new Request(new URL(`assets/optional-runtime/webllm-0.2.86-${name}.js`, scope), { signal })));
  },
  loadSDK: () => import('../../assets/optional-runtime/webllm-0.2.86-client.js'),
  createWorker: () => new Worker(new URL('../../assets/optional-runtime/webllm-0.2.86-worker.js', import.meta.url), { type: 'module' })
};
export class WebLLMProvider {
  constructor({ enabled = FEATURES.browserInference, dependencies = {}, preparationTimeoutMs = 180000 } = {}) {
    this.enabled = enabled; this.profile = MODEL_PROFILE; this.state = enabled ? 'awaiting_download_choice' : 'disabled';
    this.identity = `${MODEL_PROFILE.runtime}:${MODEL_PROFILE.weightsRevision}:${MODEL_PROFILE.libraryRevision}`;
    this.worker = null; this.engine = null; this.failures = 0; this.pendingReject = null;
    this.dependencies = { ...runtimeDependencies, ...dependencies };
    this.preparationTimeoutMs = Math.max(1, Math.min(180000, preparationTimeoutMs));
  }
  getStatus() { return { state: this.state, provider: 'webllm', artifact: this.identity, qualified: this.profile.qualified }; }
  async prepare(profile = MODEL_PROFILE, { consent = false, allowUnqualified = false, signal, onProgress = () => {} } = {}) {
    if (!this.enabled) throw new Error('disabled');
    if (this.preparing || this.state === 'generating') throw new Error('busy');
    if (profile.id !== MODEL_PROFILE.id || !consent) { this.state = 'awaiting_download_choice'; throw new Error('download_choice_required'); }
    if (!profile.qualified && !allowUnqualified) throw new Error('device_qualification_required');
    if (this.failures >= 2) throw new Error('session_retry_limit');
    if (signal?.aborted) throw new Error('cancelled');
    this.worker?.terminate(); this.worker = null; this.engine = null;
    const start = performance.now(), controller = new AbortController();
    this.preparing = true; this.state = 'loading';
    const checkActive = () => { if (controller.signal.aborted) throw controller.signal.reason; };
    let timer, stop;
    const stopped = new Promise((_, reject) => {
      stop = (error = new Error('cancelled')) => {
        if (controller.signal.aborted) return;
        controller.abort(error); this.worker?.terminate(); this.worker = null; this.engine = null; reject(error);
      };
    });
    this.pendingReject = stop;
    const cancel = () => stop(new Error('cancelled'));
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => stop(new Error('timeout')), this.preparationTimeoutMs);
    try {
      return await Promise.race([(async () => {
        const report = await this.dependencies.probe(); checkActive();
        if (!report.eligible) throw new Error('unsupported');
        this.state = 'downloading';
        // Flag-off boot never calls these. The deadline also covers cache/network and dynamic import.
        await this.dependencies.cacheRuntime(controller.signal); checkActive();
        const sdk = await this.dependencies.loadSDK(); checkActive();
        this.worker = this.dependencies.createWorker();
        const failure = new Promise((_, reject) => { this.worker.onerror = () => reject(new Error('worker_terminated')); });
        const engine = await Promise.race([sdk.CreateWebWorkerMLCEngine(this.worker, profile.modelId, { appConfig: modelAppConfig(profile),
          initProgressCallback: (progress) => {
            if (controller.signal.aborted) return;
            this.state = progress.progress >= 1 ? 'loading' : 'downloading';
            onProgress({ phase: this.state, fraction: progress.progress, text: progress.text });
          } }), failure]);
        checkActive(); this.engine = engine; this.state = 'ready';
        return { ...this.getStatus(), loadMs: Math.round(performance.now() - start), capability: report };
      })(), stopped]);
    } catch (e) {
      stop(e); this.failures++; this.state = e.message === 'unsupported' ? 'unsupported' : 'recoverable_error'; throw e;
    } finally { clearTimeout(timer); controller.abort(new Error('cancelled')); this.pendingReject = null; this.preparing = false; signal?.removeEventListener('abort', cancel); }
  }
  async runTask(request, { prompt, signal } = {}) {
    if (!this.engine || this.state !== 'ready') throw new Error('not_ready');
    if (signal?.aborted) throw new Error('cancelled');
    const engine = this.engine;
    this.state = 'generating';
    const cancel = () => this.cancel(request.requestId); signal?.addEventListener('abort', cancel, { once: true });
    try {
      const started = performance.now(); let firstToken = null, text = '', finish = null, outputTokens = null;
      const chunks = await engine.chat.completions.create({ messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: JSON.stringify(request.input) }],
        max_tokens: prompt.maxTokens, temperature: 0, stream: true, stream_options: { include_usage: true }, response_format: { type: 'json_object', schema: JSON.stringify(prompt.schema) } });
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta && firstToken === null) firstToken = performance.now();
        text += delta; finish = chunk.choices[0]?.finish_reason || finish;
        if (chunk.usage) outputTokens = chunk.usage.completion_tokens;
        if (text.length > 4096) throw new Error('validation_failed');
        if (signal?.aborted) throw new Error('cancelled');
      }
      if (signal?.aborted || this.engine !== engine) throw new Error('cancelled');
      if (finish !== 'stop') throw new Error('validation_failed');
      const completed = performance.now();
      this.lastTimings = { ttftMs: firstToken === null ? null : Math.round(firstToken - started), generationMs: Math.round(completed - started), outputTokens,
        decodeTokensPerSecond: outputTokens && firstToken !== null && completed > firstToken ? Math.round(outputTokens * 1000 / (completed - firstToken)) : null };
      return text;
    } catch (error) {
      if (/device.*lost|GPU/i.test(error.message)) {
        if (this.engine === engine) { this.failures++; this.worker?.terminate(); this.worker = null; this.engine = null; this.state = 'recoverable_error'; }
        throw new Error('device_lost');
      }
      throw error;
    } finally { signal?.removeEventListener('abort', cancel); if (this.engine === engine && this.state === 'generating') this.state = 'ready'; }
  }
  cancel() {
    if (this.pendingReject) { this.pendingReject(new Error('cancelled')); return; }
    // A timed-out stream must not keep using an engine that a later task could reuse.
    if (this.state === 'generating') { this.worker?.terminate(); this.worker = null; this.engine = null; this.state = 'recoverable_error'; }
  }
  async removeModel() {
    if (!this.enabled) throw new Error('disabled'); this.dispose();
    const sdk = await import('../../assets/optional-runtime/webllm-0.2.86-client.js');
    await sdk.deleteModelAllInfoInCache(this.profile.modelId, modelAppConfig(this.profile));
    if ('caches' in globalThis) await caches.delete(`sharp:models:runtime:${new URL('../../', import.meta.url).href}:0.2.86`);
    this.state = 'awaiting_download_choice';
  }
  dispose() { this.worker?.terminate(); this.engine = null; this.worker = null; this.pendingReject?.(new Error('cancelled')); this.state = this.enabled ? 'awaiting_download_choice' : 'disabled'; }
}
