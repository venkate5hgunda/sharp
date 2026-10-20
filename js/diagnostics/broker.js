import { FEATURES } from '../core/feature-flags.js';
import { createId } from '../core/identity.js';
import { localDayKey } from '../core/calendar.js';
const EVENTS = new Set(['app.error', 'app.warning', 'storage.write_failed', 'migration.failed', 'content.rejected', 'ai.task_started', 'ai.task_completed', 'ai.validation_failed', 'ai.fallback_used', 'ai.device_lost', 'ai.feedback']);
const CODES = new Set(['ok', 'other', 'timeout', 'cancelled', 'invalid_json', 'validation_failed', 'invalid_input', 'device_lost', 'worker_terminated', 'storage_failed', 'provider_error', 'quota', 'unknown', 'disabled', 'not_ready', 'incorrect_explanation', 'unclear_wording', 'duplicate_item', 'too_slow']);
export function sanitizeEvent(name, fields = {}, now = Date.now()) {
  if (!EVENTS.has(name)) return null;
  const properties = { code: CODES.has(fields.code) ? fields.code : 'other' };
  if (Number.isFinite(fields.durationMs)) properties.durationMs = Math.max(0, Math.min(600000, Math.round(fields.durationMs)));
  if (['stub', 'model', 'validated-cache', 'curated-fallback'].includes(fields.source)) properties.source = fields.source;
  return { id: createId('event'), schemaVersion: 1, name, timestamp: now, properties };
}
export class DiagnosticsBroker {
  constructor(repo, { flags = FEATURES, transport = null, now = () => Date.now() } = {}) { this.repo = repo; this.flags = flags; this.transport = transport; this.now = now; this.pending = null; this.flushing = false; this.unsubscribe = repo.subscribe((s) => { if (!this.allowed(s.preferences)) this.pending?.abort(); }); }
  allowed(p) { return this.flags.remoteDeveloperTelemetry && p.sharing === true; }
  async record(name, fields) {
    const event = sanitizeEvent(name, fields, this.now()); if (!event) return;
    try { await this.repo.update((s) => {
      s.diagnostics.push(event); s.diagnostics = s.diagnostics.slice(-500);
      const permitted = this.allowed(s.preferences) && (!name.startsWith('app.') || this.flags.remoteAppDiagnostics && s.preferences.shareErrors);
      if (permitted) { s.outbox.push({ id: event.id, event, attempts: 0, nextAt: 0 }); s.outbox = s.outbox.slice(-200); }
      return s;
    }); } catch {} // Diagnostic failure cannot break training or recurse into itself.
  }
  async setSharing(enabled, { errors = false, payloads = false } = {}) {
    if (enabled && !this.flags.remoteDeveloperTelemetry) throw new Error('Remote sharing is disabled by this deployment.');
    this.pending?.abort();
    await this.repo.update((s) => { s.preferences.sharing = enabled; s.preferences.shareErrors = enabled && errors && this.flags.remoteAppDiagnostics;
      s.preferences.sharePayloads = enabled && payloads && this.flags.remotePromptPayloads;
      if (!enabled) { s.outbox = []; delete s.preferences.uploadLease; } return s; });
  }
  preview() { return this.repo.snapshot().outbox.map(({ event }) => this.remoteEvent(event)); }
  remoteEvent(event) {
    const safe = sanitizeEvent(event.name, event.properties, event.timestamp);
    if (!safe || !/^event_[a-zA-Z0-9-]{1,100}$/.test(event.id) || !Number.isFinite(event.timestamp)) throw new Error('Invalid diagnostic event.');
    return { event: event.name, timestamp: new Date(Math.floor(event.timestamp / 60000) * 60000).toISOString(),
      properties: { ...safe.properties, schemaVersion: 1, $insert_id: event.id, $process_person_profile: false, $geoip_disable: true } };
  }
  async flush() {
    if (this.flushing || !this.flags.remoteDeveloperTelemetry || !this.transport) return { sent: 0, reason: 'disabled_or_busy' };
    this.flushing = true; const lease = createId('upload'); let batch = [], timer;
    try {
      await this.repo.update((s) => {
        if (!this.allowed(s.preferences) || s.preferences.uploadLease?.until > this.now()) return s;
        const date = localDayKey(this.now()), budget = s.preferences.remoteBudget?.date === date ? s.preferences.remoteBudget.count : 0;
        s.outbox = s.outbox.filter((item) => item.event.timestamp > this.now() - 7 * 86400000);
        batch = s.outbox.filter((item) => item.nextAt <= this.now() && item.attempts < 3).slice(0, Math.max(0, Math.min(10, 20 - budget)));
        if (batch.length) { s.preferences.uploadLease = { id: lease, until: this.now() + 15000 }; s.preferences.remoteBudget = { date, count: budget + batch.length }; }
        return s;
      });
      if (!batch.length) return { sent: 0, reason: 'empty_opted_out_capped_or_owned' };
      const ids = new Set(batch.map((b) => b.id)), body = batch.map((b) => this.remoteEvent(b.event));
      if (new TextEncoder().encode(JSON.stringify(body)).length > 64000) return { sent: 0, reason: 'payload_cap' };
      this.pending = new AbortController();
      const latest = await this.repo.refresh();
      if (!this.allowed(latest.preferences) || latest.preferences.uploadLease?.id !== lease) return { sent: 0, reason: 'opted_out' };
      await Promise.race([this.transport.send(body, { signal: this.pending.signal }), new Promise((_, reject) => {
        timer = setTimeout(() => { this.pending?.abort(); reject(new Error('timeout')); }, 10000);
        this.pending.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      })]);
      await this.repo.update((s) => { s.outbox = s.outbox.filter((b) => !ids.has(b.id)); return s; });
      return { sent: batch.length };
    } catch {
      const attempted = new Set(batch.map((b) => b.id));
      await this.repo.update((s) => { if (!this.allowed(s.preferences)) { s.outbox = []; return s; }
        s.outbox = s.outbox.map((item) => attempted.has(item.id) ? { ...item, attempts: item.attempts + 1, nextAt: this.now() + Math.min(3600000, 30000 * 2 ** item.attempts) + Math.floor(Math.random() * 1000) } : item).filter((item) => item.attempts < 3); return s;
      }).catch(() => {}); return { sent: 0, reason: 'transport_failed' };
    } finally {
      clearTimeout(timer); this.pending = null; this.flushing = false;
      await this.repo.update((s) => { if (s.preferences.uploadLease?.id === lease) delete s.preferences.uploadLease; return s; }).catch(() => {});
    }
  }
  dispose() { this.pending?.abort(); this.unsubscribe?.(); }
}
