// RFC 8291 payload encryption and VAPID signing; no storage or HTTP routing.
const encoder = new TextEncoder();
export const bytes = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const base64url = (value) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
export const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
export const hash = async (value) =>
  base64url(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const hmac = async (key, data) =>
  new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      data
    )
  );
const expand = async (key, info, length) =>
  (await hmac(key, concat(encoder.encode(info), new Uint8Array([1])))).slice(0, length);
export async function encryptedPush(subscription, payload) {
  const recipient = bytes(subscription.keys.p256dh),
    auth = bytes(subscription.keys.auth);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const sender = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const recipientKey = await crypto.subtle.importKey(
    'raw',
    recipient,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientKey }, pair.privateKey, 256)
  );
  const keyInfo = concat(encoder.encode('WebPush: info\0'), recipient, sender);
  const ikm = (await hmac(await hmac(auth, secret), concat(keyInfo, new Uint8Array([1])))).slice(
    0,
    32
  );
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    prk = await hmac(salt, ikm);
  const key = await expand(prk, 'Content-Encoding: aes128gcm\0', 16),
    nonce = await expand(prk, 'Content-Encoding: nonce\0', 12);
  const plaintext = concat(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  if (plaintext.length > 1000) throw new Error('Push payload too large');
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']),
      plaintext
    )
  );
  return concat(salt, new Uint8Array([0, 0, 16, 0, 65]), sender, ciphertext);
}
export async function vapidAuthorization(endpoint, privateJWK, publicKey, now = Date.now()) {
  const header = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 43200,
        sub: 'https://venkate5hgunda.github.io/sharp/',
      })
    )
  );
  const input = header + '.' + claims;
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(privateJWK),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(input)
  );
  return `vapid t=${input}.${base64url(signature)}, k=${publicKey}`;
}
