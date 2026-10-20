import { fallback } from './prompt-registry.js';
export class StubProvider {
  constructor({ scenario = 'success', delayMs = 0 } = {}) { this.scenario = scenario; this.delayMs = delayMs; this.requests = new Map(); this.status = 'disabled'; this.identity = 'sharp-stub-v1'; }
  getStatus() { return { state: this.status, provider: 'stub', artifact: this.identity }; }
  async prepare() { this.status = 'ready'; return this.getStatus(); }
  async runTask(request, { signal } = {}) {
    this.status = 'generating';
    let cancel;
    try {
      await new Promise((resolve, reject) => {
        cancel = () => { clearTimeout(timer); reject(new Error('cancelled')); };
        const timer = setTimeout(resolve, this.scenario === 'timeout' ? 60000 : this.delayMs);
        this.requests.set(request.requestId, cancel); signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
      });
      if (['device_lost', 'worker_terminated', 'storage_failed'].includes(this.scenario)) throw new Error(this.scenario);
      if (this.scenario === 'invalid_json') return '{broken';
      if (this.scenario === 'wrong_answer') return { answer: request.input.answer + 1, style: 'steps' };
      return fallback(request.input);
    } finally { signal?.removeEventListener('abort', cancel); this.requests.delete(request.requestId); this.status = 'ready'; }
  }
  cancel(requestId) { this.requests.get(requestId)?.(); }
  dispose() { for (const cancel of this.requests.values()) cancel(); this.requests.clear(); this.status = 'disabled'; }
}
