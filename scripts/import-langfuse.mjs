// Developer machine only. The default is a dry run. No secret is bundled into Sharp.
import { readFile } from 'node:fs/promises';
const file = process.argv.find((arg) => arg.endsWith('.json'));
if (!file) throw new Error('Usage: node scripts/import-langfuse.mjs diagnostics.json [--send]');
const document = JSON.parse(await readFile(file, 'utf8'));
const traces = (document.traces || []).slice(0, 100).filter((t) => t.taskId === 'arithmetic-explanation' && /^request_[a-zA-Z0-9-]{1,100}$/.test(t.requestId) && Number.isFinite(t.timestamp));
const version = (value) => /^\d+\.\d+\.\d+$/.test(value) ? value : 'unknown';
const source = (value) => ['stub', 'model', 'validated-cache', 'curated-fallback'].includes(value) ? value : 'unknown';
const reason = (value) => ['timeout', 'cancelled', 'invalid_json', 'validation_failed', 'invalid_input', 'device_lost', 'worker_terminated', 'storage_failed', 'provider_error', 'disabled', 'not_ready'].includes(value) ? value : null;
const batch = traces.map((trace, i) => ({ id: `sharp-import-${i}-${trace.requestId}`, type: 'trace-create', timestamp: new Date(trace.timestamp).toISOString(),
  body: { id: trace.requestId, name: 'sharp.arithmetic-explanation', timestamp: new Date(trace.timestamp).toISOString(),
    metadata: { promptVersion: version(trace.promptVersion), validatorVersion: version(trace.validatorVersion), source: source(trace.source), reason: reason(trace.reason), totalMs: Math.max(0, Math.min(600000, Number(trace.timings?.totalMs) || 0)) } } }));
if (!process.argv.includes('--send')) { console.log(JSON.stringify({ dryRun: true, traceCount: batch.length, batch }, null, 2)); }
else {
  const host = new URL(process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com');
  if (host.protocol !== 'https:' || host.username || host.password) throw new Error('Use an HTTPS Langfuse host.');
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY, secret = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secret) throw new Error('Set Langfuse keys in your local environment. Never put them in app files.');
  const response = await fetch(new URL('/api/public/ingestion', host), { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${publicKey}:${secret}`).toString('base64')}` }, body: JSON.stringify({ batch }) });
  if (!response.ok) throw new Error(`Import failed (${response.status}); no credentials were logged.`);
  const result = await response.json();
  if (result.errors?.length) throw new Error('Import reported partial failures; inspect the provider dashboard. No credentials were logged.');
  console.log(JSON.stringify({ sent: batch.length }));
}
