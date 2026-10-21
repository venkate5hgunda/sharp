import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, hkdfSync, createDecipheriv, createPublicKey, verify } from 'node:crypto';
import worker, { base64url, bytes, encryptedPush, vapidAuthorization, validateRegistration, due, localClock } from '../server/push/worker.js';
const origin='https://venkate5hgunda.github.io';
function fixture(){const ec=createECDH('prime256v1');ec.generateKeys();const auth=crypto.getRandomValues(new Uint8Array(16));return {ec,auth,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-test',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:base64url(auth)}}};}
class Bucket {
  constructor(){this.values=new Map();this.sequence=0;}
  async get(key){const value=this.values.get(key);return value?{etag:value.etag,json:async()=>JSON.parse(value.text)}:null;}
  async put(key,text,{onlyIf}={}){const old=this.values.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.sequence);this.values.set(key,{etag,text});return {etag};}
  async delete(key){this.values.delete(key);}
  async list({prefix,limit=1000}={}){const rows=[...this.values.keys()].filter(k=>k.startsWith(prefix));return {objects:rows.slice(0,limit).map(key=>({key})),truncated:rows.length>limit,cursor:null};}
}
const token='a'.repeat(43);
const request=(path,body,method='POST',bearer=token)=>new Request('https://push.example'+path,{method,headers:{Origin:origin,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Web Push encryption decrypts through independent Node ECDH, HKDF and AES-GCM',async()=>{
 const {ec,auth,subscription}=fixture();const message={kind:'recall'};const body=Buffer.from(await encryptedPush(subscription,message));
 assert.equal(body.readUInt32BE(16),4096);assert.equal(body[20],65);
 const sender=body.subarray(21,86),secret=ec.computeSecret(sender),recipient=ec.getPublicKey();
 const ikm=Buffer.from(hkdfSync('sha256',secret,auth,Buffer.concat([Buffer.from('WebPush: info\0'),recipient,sender]),32));
 const key=Buffer.from(hkdfSync('sha256',ikm,body.subarray(0,16),Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,body.subarray(0,16),Buffer.from('Content-Encoding: nonce\0'),12));
 const ciphertext=body.subarray(86),decipher=createDecipheriv('aes-128-gcm',key,nonce);decipher.setAuthTag(ciphertext.subarray(-16));
 const plaintext=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);assert.equal(plaintext.at(-1),2);assert.deepEqual(JSON.parse(plaintext.subarray(0,-1)),message);
});
test('VAPID binds an independently verified signature to the push-provider origin',async()=>{
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);const pub=base64url(await crypto.subtle.exportKey('raw',pair.publicKey));
 const header=await vapidAuthorization('https://fcm.googleapis.com/fcm/send/test',JSON.stringify(jwk),pub,1000000);const jwt=header.match(/t=([^,]+)/)[1];const [h,p,s]=jwt.split('.');
 assert.ok(verify('sha256',Buffer.from(h+'.'+p),{key:createPublicKey({key:await crypto.subtle.exportKey('jwk',pair.publicKey),format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(bytes(s))));
 assert.equal(JSON.parse(Buffer.from(bytes(p))).aud,'https://fcm.googleapis.com');assert.equal(JSON.parse(Buffer.from(bytes(p))).exp,44200);
});
test('registration rejects private addresses, provider lookalikes, malformed keys and out-of-hours reminders',()=>{
 const body={subscription:fixture().subscription,timezone:'America/Los_Angeles',reminderTime:'08:30'};assert.ok(validateRegistration(body));
 for(const endpoint of ['http://fcm.googleapis.com/send','https://127.0.0.1/','https://fcm.googleapis.com.evil.example/','https://fcm.googleapis.com:8443/send','https://user@fcm.googleapis.com/send'])assert.throws(()=>validateRegistration({...body,subscription:{...body.subscription,endpoint}}));
 assert.throws(()=>validateRegistration({...body,timezone:'invalid/zone'}));assert.throws(()=>validateRegistration({...body,reminderTime:'03:30'}));
});
test('local day scheduling handles DST, quiet hours, completed workouts and daily deduplication',()=>{
 const r={timezone:'America/Los_Angeles',reminderTime:'08:30',memoryReadyAt:null,completedDate:null};
 const spring=Date.parse('2026-03-08T15:30:00Z');assert.equal(localClock(r.timezone,spring).minute,510);assert.equal(due(r,spring).day,'2026-03-08');
 assert.equal(due({...r,lastAttemptDay:'2026-03-08'},spring),null);assert.equal(due({...r,completedDate:'2026-03-08'},spring),null);
 assert.equal(due(r,Date.parse('2026-03-09T04:00:00Z')),null);assert.equal(due({...r,memoryReadyAt:spring-1,completedDate:'2026-03-08'},spring).kind,'recall');
 assert.equal(localClock(r.timezone,Date.parse('2026-11-01T16:30:00Z')).minute,510);
});
test('subscription writes require management capability, enforce CORS and support deletion',async()=>{
 const env={BUCKET:new Bucket()},body={subscription:fixture().subscription,timezone:'UTC',reminderTime:'08:30'};
 assert.equal((await worker.fetch(request('/v1/subscriptions',body),env)).status,200);
 assert.equal((await worker.fetch(request('/v1/subscriptions',body,'POST','b'.repeat(43)),env)).status,401);
 const untrusted=request('/v1/subscriptions',body);untrusted.headers.set('Origin','https://evil.example');assert.equal((await worker.fetch(untrusted,env)).status,403);
 assert.equal((await worker.fetch(request('/v1/subscriptions',{endpoint:body.subscription.endpoint},'DELETE'),env)).status,200);
 assert.equal((await env.BUCKET.list({prefix:'subscriptions/'})).objects.length,0);
 assert.equal((await worker.fetch(request('/internal/tick',{}),env)).status,401);
});
test('scheduler requires signed GitHub identity for the exact production workflow',async()=>{
 const {generateKeyPairSync,sign}=await import('node:crypto');const pair=generateKeyPairSync('rsa',{modulusLength:2048});const key={...pair.publicKey.export({format:'jwk'}),kid:'fixture'};
 const now=Date.now(),seconds=Math.floor(now/1000);const claims={iss:'https://token.actions.githubusercontent.com',aud:'https://sharp-push.cheeryowl513.chatgpt.site',repository:'venkate5hgunda/sharp',repository_id:'1425104007',ref:'refs/heads/main',workflow_ref:'venkate5hgunda/sharp/.github/workflows/push-reminders.yml@refs/heads/main',event_name:'schedule',iat:seconds,exp:seconds+300};
 const jwt=(changes={},header={})=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture',...header})).toString('base64url'),p=Buffer.from(JSON.stringify({...claims,...changes})).toString('base64url'),input=h+'.'+p;return input+'.'+sign('RSA-SHA256',Buffer.from(input),pair.privateKey).toString('base64url');};
 const {verifySchedulerJWT}=await import('../server/push/worker.js');assert.equal(await verifySchedulerJWT(jwt(),[key],now),true);
 for(const changes of [{aud:'other'},{repository_id:'1'},{ref:'refs/heads/work'},{workflow_ref:'other'},{event_name:'pull_request'},{exp:seconds-1},{iat:seconds-700},{iss:'https://evil.example'}])assert.equal(await verifySchedulerJWT(jwt(changes),[key],now),false);
 assert.equal(await verifySchedulerJWT(jwt({}, {alg:'none'}),[key],now),false);assert.equal(await verifySchedulerJWT(jwt(),[],now),false);assert.equal(await verifySchedulerJWT(jwt().slice(0,-8)+'AAAAAAAA',[key],now),false);
});
test('concurrent ticks reserve one daily attempt, including failed deliveries, and remove expired subscriptions',async()=>{
 const realFetch=globalThis.fetch,realNow=Date.now;Date.now=()=>Date.parse('2026-10-21T12:00:00Z');
 try{
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const env={BUCKET:new Bucket(),SCHEDULER_SECRET:'test-only',VAPID_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.privateKey)),VAPID_PUBLIC_KEY:base64url(await crypto.subtle.exportKey('raw',pair.publicKey))};
 const body={subscription:fixture().subscription,timezone:'UTC',reminderTime:'08:30'};assert.equal((await worker.fetch(request('/v1/subscriptions',body),env)).status,200);
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:503});};
 const tick=()=>worker.fetch(request('/internal/tick',{},'POST','test-only'),env).then(r=>r.json());await Promise.all([tick(),tick()]);assert.equal(calls,1);assert.equal((await tick()).skipped,1);
 Date.now=()=>Date.parse('2026-10-22T12:00:00Z');globalThis.fetch=async()=>new Response('',{status:410});assert.equal((await tick()).expired,1);assert.equal((await env.BUCKET.list({prefix:'subscriptions/'})).objects.length,0);
 assert.equal(due({...body,memoryReadyAt:Date.now()+3600000},Date.now()),null);
 }finally{globalThis.fetch=realFetch;Date.now=realNow;}
});
