// Scheduler identity checks and durable delivery orchestration.
import { bytes, encryptedPush, vapidAuthorization } from './crypto.js';
import { due } from './policy.js';
const encoder = new TextEncoder();

export async function verifySchedulerJWT(token, keys, now = Date.now()) {
  try {
    const [headerPart, bodyPart, signature, extra] = token.split('.');
    if (extra || !signature) return false;
    const header = JSON.parse(new TextDecoder().decode(bytes(headerPart))),
      claims = JSON.parse(new TextDecoder().decode(bytes(bodyPart)));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
    const seconds = now / 1000;
    if (
      claims.iss !== 'https://token.actions.githubusercontent.com' ||
      claims.aud !== 'https://sharp-push.cheeryowl513.chatgpt.site' ||
      claims.repository !== 'venkate5hgunda/sharp' ||
      String(claims.repository_id) !== '1425104007' ||
      claims.ref !== 'refs/heads/main' ||
      claims.workflow_ref !==
        'venkate5hgunda/sharp/.github/workflows/push-reminders.yml@refs/heads/main' ||
      !['schedule', 'workflow_dispatch'].includes(claims.event_name) ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= seconds ||
      !Number.isFinite(claims.iat) ||
      claims.iat > seconds + 30 ||
      claims.iat < seconds - 600 ||
      (claims.nbf !== undefined && claims.nbf > seconds + 30)
    )
      return false;
    const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      bytes(signature),
      encoder.encode(headerPart + '.' + bodyPart)
    );
  } catch {
    return false;
  }
}
let issuerKeys = null,
  issuerKeysAt = 0;
export async function authorizedScheduler(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return false;
  if (env.SCHEDULER_SECRET && token === env.SCHEDULER_SECRET) return true;
  if (token.length > 8192 || token.split('.').length !== 3) return false;
  try {
    if (!issuerKeys || Date.now() - issuerKeysAt > 300000) {
      const response = await fetch('https://token.actions.githubusercontent.com/.well-known/jwks', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      issuerKeys = (await response.json()).keys;
      issuerKeysAt = Date.now();
    }
    return await verifySchedulerJWT(token, issuerKeys);
  } catch {
    return false;
  }
}
async function send(record, env) {
  const body = await encryptedPush(record.subscription, { kind: record.kind });
  const authorization = await vapidAuthorization(
    record.subscription.endpoint,
    env.VAPID_PRIVATE_JWK,
    env.VAPID_PUBLIC_KEY
  );
  return fetch(record.subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'low',
      Topic: 'sharp-daily',
    },
    body,
    signal: AbortSignal.timeout(6000),
    redirect: 'error',
  });
}

export async function deliverDueSubscriptions(env, { cursor } = {}) {
  const rates = await env.BUCKET.list({ prefix: 'rate/', limit: 100 });
  for (const entry of rates.objects)
    if (Number(entry.key.split('/')[1]) < Math.floor(Date.now() / 3600000) - 24)
      await env.BUCKET.delete(entry.key);
  const listed = await env.BUCKET.list({ prefix: 'subscriptions/', limit: 50, cursor: cursor });
  const counts = {
    processed: 0,
    sent: 0,
    expired: 0,
    failed: 0,
    skipped: 0,
    cursor: listed.truncated ? listed.cursor : null,
  };
  const queue = [...listed.objects];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const entry = queue.shift();
        const old = await env.BUCKET.get(entry.key);
        if (!old) continue;
        const record = await old.json();
        counts.processed++;
        if (record.updatedAt < Date.now() - 90 * 86400000) {
          await env.BUCKET.delete(entry.key);
          counts.expired++;
          continue;
        }
        const scheduled = due(record);
        if (!scheduled) {
          counts.skipped++;
          continue;
        }
        const reserved = await env.BUCKET.put(
          entry.key,
          JSON.stringify({ ...record, lastAttemptDay: scheduled.day, lastAttemptAt: Date.now() }),
          { onlyIf: { etagMatches: old.etag } }
        );
        if (!reserved) {
          counts.skipped++;
          continue;
        }
        try {
          const response = await send({ ...record, kind: scheduled.kind }, env);
          if (response.status === 404 || response.status === 410) {
            await env.BUCKET.delete(entry.key);
            counts.expired++;
          } else if (response.ok) counts.sent++;
          else counts.failed++;
        } catch {
          counts.failed++;
        }
      }
    })
  );
  return counts;
}
