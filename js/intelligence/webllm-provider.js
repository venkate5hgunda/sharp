import { FEATURES } from '../core/feature-flags.js';
import { MODEL_PROFILE, modelAppConfig } from './model-manifest.js';
import { probeCapabilities } from '../core/capabilities.js';
export class WebLLMProvider {
  constructor({ enabled = FEATURES.browserInference } = {}) {
    this.enabled = enabled; this.profile = MODEL_PROFILE; this.state = enabled ? 'awaiting_download_choice' : 'disabled';
    this.identity = `${MODEL_PROFILE.runtime}:${MODEL_PROFILE.weightsRevision}:${MODEL_PROFILE.libraryRevision}`;
    this.worker = null; this.engine = null; this.failures = 0; this.pendingReject = null;
  }
  getStatus() { return { state: this.state, provider: 'webllm', artifact: this.identity, qualified: this.profile.qualified }; }
  async prepare(profile = MODEL_PROFILE, { consent = false, allowUnqualified = false, signal, onProgress = () => {} } = {}) {
    if (!this.enabled) throw new Error('disabled');
    if (profile.id !== MODEL_PROFILE.id || !consent) { this.state = 'awaiting_download_choice'; throw new Error('download_choice_required'); }
    if (!profile.qualified && !allowUnqualified) throw new Error('device_qualification_required');
    if (this.failures >= 2) throw new Error('session_retry_limit');
    const report = await probeCapabilities(); if (!report.eligible) { this.state = 'unsupported'; throw new Error('unsupported'); }
    if (signal?.aborted) throw new Error('cancelled');
    const start = performance.now(); this.state = 'downloading';
    const cancel = () => { this.worker?.terminate(); this.engine = null; this.state = 'recoverable_error'; this.pendingReject?.(new Error('cancelled')); };
    signal?.addEventListener('abort', cancel, { once: true });
    let timer;
    try {
      // These bundles are omitted from shell precaching and never imported on flag-off boot.
      if ('caches' in globalThis) {
        const scope = new URL('../../', import.meta.url).href;
        const cache = await caches.open(`sharp:models:runtime:${scope}:0.2.86`);
        await cache.addAll(['client', 'worker'].map((name) => new Request(new URL(`assets/optional-runtime/webllm-0.2.86-${name}.js`, scope), { signal })));
      }
      const sdk = await import('../../assets/optional-runtime/webllm-0.2.86-client.js');
      if (signal?.aborted) throw new Error('cancelled');
      this.worker = new Worker(new URL('../../assets/optional-runtime/webllm-0.2.86-worker.js', import.meta.url), { type: 'module' });
      const failure = new Promise((_, reject) => { this.pendingReject = reject; this.worker.onerror = () => reject(new Error('worker_terminated'));
        timer = setTimeout(() => { this.worker?.terminate(); reject(new Error('timeout')); }, 180000); });
      this.engine = await Promise.race([sdk.CreateWebWorkerMLCEngine(this.worker, profile.modelId, { appConfig: modelAppConfig(profile),
        initProgressCallback: (progress) => { this.state = progress.progress >= 1 ? 'loading' : 'downloading'; onProgress({ phase: this.state, fraction: progress.progress, text: progress.text }); } }), failure]);
      this.state = 'ready'; return { ...this.getStatus(), loadMs: Math.round(performance.now() - start), capability: report };
    } catch (e) { this.failures++; this.worker?.terminate(); this.engine = null; this.state = 'recoverable_error'; throw e; }
    finally { clearTimeout(timer); this.pendingReject = null; signal?.removeEventListener('abort', cancel); }
  }
  async runTask(request, { prompt, signal } = {}) {
    if (!this.engine || this.state !== 'ready') throw new Error('not_ready');
    this.state = 'generating';
    const cancel = () => this.cancel(request.requestId); signal?.addEventListener('abort', cancel, { once: true });
    try {
      const started = performance.now(); let firstToken = null, text = '', finish = null, outputTokens = null;
      const chunks = await this.engine.chat.completions.create({ messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: JSON.stringify(request.input) }],
        max_tokens: prompt.maxTokens, temperature: 0, stream: true, stream_options: { include_usage: true }, response_format: { type: 'json_object', schema: JSON.stringify(prompt.schema) } });
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta && firstToken === null) firstToken = performance.now();
        text += delta; finish = chunk.choices[0]?.finish_reason || finish;
        if (chunk.usage) outputTokens = chunk.usage.completion_tokens;
        if (text.length > 4096) throw new Error('validation_failed');
        if (signal?.aborted) throw new Error('cancelled');
      }
      if (signal?.aborted) throw new Error('cancelled');
      if (finish !== 'stop') throw new Error('validation_failed');
      const completed = performance.now();
      this.lastTimings = { ttftMs: firstToken === null ? null : Math.round(firstToken - started), generationMs: Math.round(completed - started), outputTokens,
        decodeTokensPerSecond: outputTokens && firstToken !== null && completed > firstToken ? Math.round(outputTokens * 1000 / (completed - firstToken)) : null };
      return text;
    } catch (error) {
      if (/device.*lost|GPU/i.test(error.message)) { this.failures++; this.worker?.terminate(); this.engine = null; this.state = 'recoverable_error'; throw new Error('device_lost'); }
      throw error;
    } finally { signal?.removeEventListener('abort', cancel); if (this.engine) this.state = 'ready'; }
  }
  cancel() { this.engine?.interruptGenerate(); this.pendingReject?.(new Error('cancelled')); }
  async removeModel() {
    if (!this.enabled) throw new Error('disabled'); this.dispose();
    const sdk = await import('../../assets/optional-runtime/webllm-0.2.86-client.js');
    await sdk.deleteModelAllInfoInCache(this.profile.modelId, modelAppConfig(this.profile));
    if ('caches' in globalThis) await caches.delete(`sharp:models:runtime:${new URL('../../', import.meta.url).href}:0.2.86`);
    this.state = 'awaiting_download_choice';
  }
  dispose() { this.worker?.terminate(); this.engine = null; this.worker = null; this.pendingReject?.(new Error('cancelled')); this.state = this.enabled ? 'awaiting_download_choice' : 'disabled'; }
}
