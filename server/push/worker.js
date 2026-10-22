// HTTP entrypoint. Policy, cryptography and delivery have independent modules.
import { bytes, concat, hash } from './crypto.js';
import { validateRegistration } from './policy.js';
import { authorizedScheduler, deliverDueSubscriptions } from './scheduler.js';

const VERSION = 'sharp-push-v1';
const APP_ORIGIN = 'https://venkate5hgunda.github.io';
async function readJSON(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json'))
    throw new Error('JSON required');
  if (Number(request.headers.get('content-length') || 0) > 16384)
    throw new Error('Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request');
  let total = 0,
    chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 16384) {
      await reader.cancel();
      throw new Error('Request too large');
    }
    chunks.push(value);
  }
  return JSON.parse(new TextDecoder().decode(concat(...chunks)));
}
async function rateLimit(bucket, address) {
  const hour = Math.floor(Date.now() / 3600000),
    key = 'rate/' + hour + '/' + (await hash(address || 'unknown'));
  for (let attempt = 0; attempt < 4; attempt++) {
    const old = await bucket.get(key),
      value = old ? await old.json() : { count: 0 };
    if (value.count >= 30) return false;
    const stored = await bucket.put(key, JSON.stringify({ count: value.count + 1 }), {
      onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' },
    });
    if (stored) return true;
  }
  return false;
}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      origin = request.headers.get('origin');
    const permitted = !origin || origin === APP_ORIGIN || origin === url.origin;
    const cors =
      permitted && origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            Vary: 'Origin',
          }
        : {};
    if (!permitted) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health')
      return json({ ok: true, version: VERSION, storage: !!env.BUCKET }, 200, cors);
    if (url.pathname === '/v1/config' && request.method === 'GET')
      return json(
        {
          publicKey: env.VAPID_PUBLIC_KEY || null,
          ready: !!(
            env.BUCKET &&
            env.VAPID_PRIVATE_JWK &&
            env.VAPID_PUBLIC_KEY &&
            env.SCHEDULER_SECRET
          ),
          dailyLimit: 1,
          quietHours: '21:00–08:00',
        },
        200,
        cors
      );
    if (!env.BUCKET) return json({ error: 'Storage unavailable' }, 503, cors);
    if (url.pathname === '/internal/tick' && request.method === 'POST') {
      if (!(await authorizedScheduler(request, env)))
        return json({ error: 'Unauthorized' }, 401, cors);
      return json(
        await deliverDueSubscriptions(env, { cursor: url.searchParams.get('cursor') || undefined }),
        200,
        cors
      );
    }
    if (url.pathname !== '/v1/subscriptions' || !['POST', 'DELETE'].includes(request.method))
      return json({ error: 'Not found' }, 404, cors);
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) return json({ error: 'Unauthorized' }, 401, cors);
    try {
      const body = await readJSON(request);
      const endpoint = request.method === 'POST' ? body.subscription?.endpoint : body.endpoint;
      if (typeof endpoint !== 'string' || endpoint.length > 4096)
        throw new Error('Invalid endpoint');
      const key = 'subscriptions/' + (await hash(endpoint)),
        old = await env.BUCKET.get(key),
        record = old ? await old.json() : null,
        tokenHash = await hash(token);
      if (record && record.tokenHash !== tokenHash)
        return json({ error: 'Unauthorized' }, 401, cors);
      if (request.method === 'DELETE') {
        if (record) await env.BUCKET.delete(key);
        return json({ deleted: true }, 200, cors);
      }
      const registration = validateRegistration(body);
      await crypto.subtle.importKey(
        'raw',
        bytes(registration.subscription.keys.p256dh),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
      if (!(await rateLimit(env.BUCKET, request.headers.get('cf-connecting-ip'))))
        return json({ error: 'Please try again later' }, 429, cors);
      if (!record) {
        const total = await env.BUCKET.list({ prefix: 'subscriptions/', limit: 1000 });
        if (total.objects.length >= 1000 || total.truncated)
          return json({ error: 'Service capacity reached' }, 503, cors);
      }
      const result = await env.BUCKET.put(
        key,
        JSON.stringify({
          ...registration,
          tokenHash,
          lastAttemptDay: record?.lastAttemptDay || null,
          updatedAt: Date.now(),
        }),
        { onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' } }
      );
      return result
        ? json({ subscribed: true, dailyLimit: 1 }, 200, cors)
        : json({ error: 'Subscription changed; retry' }, 409, cors);
    } catch (error) {
      return json({ error: error.message }, 400, cors);
    }
  },
};
