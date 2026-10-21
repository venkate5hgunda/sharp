import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { CPU_PROFILE } from './cpu-profile.mjs';
const execute = promisify(execFile);
async function findServer(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === 'llama-server') return name;
    if (entry.isDirectory()) { const result = await findServer(name); if (result) return result; }
  }
}
export class CPUProvider {
  constructor(cacheDir) { this.cacheDir = path.resolve(cacheDir, 'cpu'); this.identity = `${CPU_PROFILE.runtime}:${CPU_PROFILE.modelSHA256}`; this.active = new Map(); this.state = 'not_ready'; }
  getStatus() { return { state: this.state, provider: 'llama.cpp-cpu', qualified: false }; }
  async prepare() {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Pinned CPU runtime currently supports Linux x64.');
    await execute('python3', [new URL('./prepare-cpu-model.py', import.meta.url).pathname, this.cacheDir, JSON.stringify(CPU_PROFILE)], { timeout: 600000, maxBuffer: 1024 * 1024 });
    const binary = await findServer(path.join(this.cacheDir, 'runtime')); if (!binary) throw new Error('CPU server missing');
    const port = await new Promise((resolve, reject) => { const server = createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
    this.token = randomUUID(); this.url = `http://127.0.0.1:${port}`;
    this.child = spawn(binary, ['--model', path.join(this.cacheDir, 'model.gguf'), '--host', '127.0.0.1', '--port', String(port), '--api-key', this.token, '--n-gpu-layers', '0', '--ctx-size', '1024', '--parallel', '1', '--threads', String(Math.min(4, availableParallelism())), '--chat-template', 'chatml', '--no-webui', '--log-disable'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let failure = null; this.child.on('error', error => { failure = error; }); this.child.on('exit', code => { failure ||= new Error(`CPU server exited: ${code}`); });
    let diagnostics = ''; this.child.stderr.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-2000); });
    for (let attempt = 0; attempt < 300; attempt++) {
      if (failure) throw new Error(`${failure.message}: ${diagnostics}`);
      try { if ((await fetch(this.url + '/health', { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(1000) })).ok) { this.state = 'ready'; return { backend: 'cpu', profile: CPU_PROFILE }; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('CPU preparation timed out');
  }
  async runTask(request, { prompt, signal } = {}) {
    if (this.state !== 'ready') throw new Error('not_ready');
    if (this.active.size) throw new Error('busy');
    const controller = new AbortController(), cancel = () => controller.abort();
    if (signal?.aborted) throw new Error('cancelled');
    signal?.addEventListener('abort', cancel, { once: true }); this.active.set(request.requestId, controller);
    try {
      const response = await fetch(this.url + '/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: JSON.stringify(request.input) }], temperature: 0, seed: 0, max_tokens: prompt.maxTokens, cache_prompt: false,
          response_format: { type: 'json_schema', json_schema: { name: 'task', strict: true, schema: prompt.schema } } }) });
      if (!response.ok) throw new Error(`CPU inference HTTP ${response.status}`);
      const raw = await response.json();
      if (raw.choices?.[0]?.finish_reason !== 'stop' || typeof raw.choices[0].message?.content !== 'string') throw new Error('validation_failed');
      return raw.choices[0].message.content;
    } finally { this.active.delete(request.requestId); signal?.removeEventListener('abort', cancel); }
  }
  cancel(id) { this.active.get(id)?.abort(); }
  dispose() { for (const controller of this.active.values()) controller.abort(); this.child?.kill('SIGKILL'); this.state = 'disposed'; }
}
