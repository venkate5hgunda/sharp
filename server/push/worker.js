// Sharp Web Push service: capability-authenticated subscriptions and at-most-once daily attempts.
const VERSION = 'sharp-push-v1';
const APP_ORIGIN = 'https://venkate5hgunda.github.io';
const encoder = new TextEncoder();
export const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export const base64url = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n,p) => n+p.length,0)); let i=0; for (const p of parts) { out.set(p,i); i+=p.length; } return out; };
const hash = async value => base64url(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, {name:'HMAC',hash:'SHA-256'}, false, ['sign']), data));
const expand = async (key, info, length) => (await hmac(key, concat(encoder.encode(info), new Uint8Array([1])))).slice(0,length);
export function localClock(timezone, now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return { day:`${parts.year}-${parts.month}-${parts.day}`, minute:Number(parts.hour)*60+Number(parts.minute) };
}
export function validateRegistration(input) {
  const sub = input?.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length>4096) throw new Error('Invalid subscription');
  const url = new URL(sub.endpoint);
  const domains = ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','notify.windows.com'];
  if (url.protocol!=='https:' || url.username || url.password || url.port || url.hash || !domains.some(d=>url.hostname===d || d==='notify.windows.com' && url.hostname.endsWith('.'+d))) throw new Error('Unsupported push provider');
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(sub.keys?.p256dh || '') || bytes(sub.keys.p256dh).length!==65 || bytes(sub.keys.p256dh)[0]!==4 || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.keys?.auth || '') || bytes(sub.keys.auth).length!==16) throw new Error('Invalid push keys');
  const time = input.reminderTime || '08:30';
  if (!/^(?:0[89]|1\d|20):[0-5]\d$/.test(time)) throw new Error('Choose a reminder time between 08:00 and 20:59');
  if (typeof input.timezone!=='string' || input.timezone.length>80) throw new Error('Invalid timezone');
  localClock(input.timezone);
  const memoryReadyAt = input.memoryReadyAt == null ? null : input.memoryReadyAt;
  if (memoryReadyAt !== null && (!Number.isSafeInteger(memoryReadyAt) || memoryReadyAt<0 || memoryReadyAt>Date.now()+7*86400000)) throw new Error('Invalid recall time');
  const completedDate = input.completedDate || null;
  if (completedDate!==null && !/^\d{4}-\d{2}-\d{2}$/.test(completedDate)) throw new Error('Invalid completion date');
  return { subscription:{endpoint:url.href,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}}, reminderTime:time, timezone:input.timezone, memoryReadyAt, completedDate };
}
export function due(record, now=Date.now()) {
  const clock=localClock(record.timezone,now), [h,m]=record.reminderTime.split(':').map(Number);
  if (clock.minute<Math.max(480,h*60+m) || clock.minute>=1260 || record.lastAttemptDay===clock.day) return null;
  if(record.memoryReadyAt!==null&&record.memoryReadyAt>now)return null;
  if (record.memoryReadyAt!==null && record.memoryReadyAt<=now) return {day:clock.day,kind:'recall'};
  return record.completedDate===clock.day ? null : {day:clock.day,kind:'study'};
}
export async function encryptedPush(subscription, payload) {
  const recipient=bytes(subscription.keys.p256dh), auth=bytes(subscription.keys.auth);
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const sender=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const recipientKey=await crypto.subtle.importKey('raw',recipient,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:recipientKey},pair.privateKey,256));
  const keyInfo=concat(encoder.encode('WebPush: info\0'),recipient,sender);
  const ikm=(await hmac(await hmac(auth,secret),concat(keyInfo,new Uint8Array([1])))).slice(0,32);
  const salt=crypto.getRandomValues(new Uint8Array(16)), prk=await hmac(salt,ikm);
  const key=await expand(prk,'Content-Encoding: aes128gcm\0',16), nonce=await expand(prk,'Content-Encoding: nonce\0',12);
  const plaintext=concat(encoder.encode(JSON.stringify(payload)),new Uint8Array([2]));
  if (plaintext.length>1000) throw new Error('Push payload too large');
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']),plaintext));
  return concat(salt,new Uint8Array([0,0,16,0,65]),sender,ciphertext);
}
export async function vapidAuthorization(endpoint, privateJWK, publicKey, now=Date.now()) {
  const header=base64url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claims=base64url(encoder.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+43200,sub:'https://venkate5hgunda.github.io/sharp/'})));
  const input=header+'.'+claims;
  const key=await crypto.subtle.importKey('jwk',JSON.parse(privateJWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(input));
  return `vapid t=${input}.${base64url(signature)}, k=${publicKey}`;
}
export async function verifySchedulerJWT(token, keys, now=Date.now()) {
  try {
    const [headerPart,bodyPart,signature,extra]=token.split('.');if(extra||!signature)return false;
    const header=JSON.parse(new TextDecoder().decode(bytes(headerPart))),claims=JSON.parse(new TextDecoder().decode(bytes(bodyPart)));
    if(header.alg!=='RS256'||typeof header.kid!=='string')return false;
    const seconds=now/1000;
    if(claims.iss!=='https://token.actions.githubusercontent.com'||claims.aud!=='https://sharp-push.cheeryowl513.chatgpt.site'||claims.repository!=='venkate5hgunda/sharp'||String(claims.repository_id)!=='1425104007'||claims.ref!=='refs/heads/main'||claims.workflow_ref!=='venkate5hgunda/sharp/.github/workflows/push-reminders.yml@refs/heads/main'||!['schedule','workflow_dispatch'].includes(claims.event_name)||!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds+30||claims.iat<seconds-600||claims.nbf!==undefined&&claims.nbf>seconds+30)return false;
    const jwk=keys.find(key=>key.kid===header.kid&&key.kty==='RSA');if(!jwk)return false;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(signature),encoder.encode(headerPart+'.'+bodyPart));
  }catch{return false;}
}
let issuerKeys=null,issuerKeysAt=0;
async function authorizedScheduler(request,env) {
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return false;
  if(env.SCHEDULER_SECRET&&token===env.SCHEDULER_SECRET)return true;
  if(token.length>8192||token.split('.').length!==3)return false;
  try {
    if(!issuerKeys||Date.now()-issuerKeysAt>300000){const response=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks',{signal:AbortSignal.timeout(5000)});if(!response.ok)return false;issuerKeys=(await response.json()).keys;issuerKeysAt=Date.now();}
    return await verifySchedulerJWT(token,issuerKeys);
  }catch{return false;}
}
async function send(record, env) {
  const body=await encryptedPush(record.subscription,{kind:record.kind});
  const authorization=await vapidAuthorization(record.subscription.endpoint,env.VAPID_PRIVATE_JWK,env.VAPID_PUBLIC_KEY);
  return fetch(record.subscription.endpoint,{method:'POST',headers:{Authorization:authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'3600',Urgency:'low',Topic:'sharp-daily'},body,signal:AbortSignal.timeout(6000),redirect:'error'});
}
async function readJSON(request) {
  if (!(request.headers.get('content-type')||'').startsWith('application/json')) throw new Error('JSON required');
  if (Number(request.headers.get('content-length')||0)>16384) throw new Error('Request too large');
  const reader=request.body?.getReader(); if (!reader) throw new Error('Empty request'); let total=0, chunks=[];
  while (true) { const {value,done}=await reader.read(); if (done) break; total+=value.length; if(total>16384){await reader.cancel();throw new Error('Request too large');} chunks.push(value); }
  return JSON.parse(new TextDecoder().decode(concat(...chunks)));
}
async function rateLimit(bucket, address) {
  const hour=Math.floor(Date.now()/3600000), key='rate/'+hour+'/'+await hash(address||'unknown');
  for(let attempt=0;attempt<4;attempt++) {
    const old=await bucket.get(key), value=old?await old.json():{count:0}; if(value.count>=30) return false;
    const stored=await bucket.put(key,JSON.stringify({count:value.count+1}),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'}}); if(stored) return true;
  } return false;
}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export default {
  async fetch(request,env) {
    const url=new URL(request.url), origin=request.headers.get('origin');
    const permitted=!origin || origin===APP_ORIGIN || origin===url.origin;
    const cors=permitted&&origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization',Vary:'Origin'}:{};
    if(!permitted) return json({error:'Origin not allowed'},403);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
    if(url.pathname==='/health') return json({ok:true,version:VERSION,storage:!!env.BUCKET},200,cors);
    if(url.pathname==='/v1/config' && request.method==='GET') return json({publicKey:env.VAPID_PUBLIC_KEY||null,ready:!!(env.BUCKET&&env.VAPID_PRIVATE_JWK&&env.VAPID_PUBLIC_KEY&&env.SCHEDULER_SECRET),dailyLimit:1,quietHours:'21:00–08:00'},200,cors);
    if(!env.BUCKET) return json({error:'Storage unavailable'},503,cors);
    if(url.pathname==='/internal/tick' && request.method==='POST') {
      if(!await authorizedScheduler(request,env)) return json({error:'Unauthorized'},401,cors);
      const rates=await env.BUCKET.list({prefix:'rate/',limit:100});
      for(const entry of rates.objects) if(Number(entry.key.split('/')[1])<Math.floor(Date.now()/3600000)-24) await env.BUCKET.delete(entry.key);
      const listed=await env.BUCKET.list({prefix:'subscriptions/',limit:50,cursor:url.searchParams.get('cursor')||undefined});
      const counts={processed:0,sent:0,expired:0,failed:0,skipped:0,cursor:listed.truncated?listed.cursor:null};
      const queue=[...listed.objects];
      await Promise.all(Array.from({length:4},async()=>{while(queue.length){const entry=queue.shift();const old=await env.BUCKET.get(entry.key);if(!old)continue;const record=await old.json();counts.processed++;
        if(record.updatedAt<Date.now()-90*86400000){await env.BUCKET.delete(entry.key);counts.expired++;continue;}
        const scheduled=due(record);if(!scheduled){counts.skipped++;continue;}
        const reserved=await env.BUCKET.put(entry.key,JSON.stringify({...record,lastAttemptDay:scheduled.day,lastAttemptAt:Date.now()}),{onlyIf:{etagMatches:old.etag}});
        if(!reserved){counts.skipped++;continue;}
        try{const response=await send({...record,kind:scheduled.kind},env);if(response.status===404||response.status===410){await env.BUCKET.delete(entry.key);counts.expired++;}else if(response.ok)counts.sent++;else counts.failed++;}catch{counts.failed++;}
      }}));
      return json(counts,200,cors);
    }
    if(url.pathname!=='/v1/subscriptions' || !['POST','DELETE'].includes(request.method)) return json({error:'Not found'},404,cors);
    const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)return json({error:'Unauthorized'},401,cors);
    try {
      const body=await readJSON(request);const endpoint=request.method==='POST'?body.subscription?.endpoint:body.endpoint;
      if(typeof endpoint!=='string'||endpoint.length>4096)throw new Error('Invalid endpoint');
      const key='subscriptions/'+await hash(endpoint), old=await env.BUCKET.get(key), record=old?await old.json():null, tokenHash=await hash(token);
      if(record&&record.tokenHash!==tokenHash)return json({error:'Unauthorized'},401,cors);
      if(request.method==='DELETE'){if(record)await env.BUCKET.delete(key);return json({deleted:true},200,cors);}
      const registration=validateRegistration(body);
      await crypto.subtle.importKey('raw',bytes(registration.subscription.keys.p256dh),{name:'ECDH',namedCurve:'P-256'},false,[]);
      if(!await rateLimit(env.BUCKET,request.headers.get('cf-connecting-ip')))return json({error:'Please try again later'},429,cors);
      if(!record){const total=await env.BUCKET.list({prefix:'subscriptions/',limit:1000});if(total.objects.length>=1000||total.truncated)return json({error:'Service capacity reached'},503,cors);}
      const result=await env.BUCKET.put(key,JSON.stringify({...registration,tokenHash,lastAttemptDay:record?.lastAttemptDay||null,updatedAt:Date.now()}),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'}});
      return result?json({subscribed:true,dailyLimit:1},200,cors):json({error:'Subscription changed; retry'},409,cors);
    }catch(error){return json({error:error.message},400,cors);}
  }
};
