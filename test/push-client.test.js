import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribePush, syncPushState, disableAlerts } from '../js/push.js';
const config={subscriptionEndpoint:'https://sharp-push.cheeryowl513.chatgpt.site/v1/subscriptions',applicationServerKey:'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'};
async function harness(run,{existing=false}={}) {
 const names=['window','navigator','Notification','location','isSecureContext','fetch'],previous=Object.fromEntries(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 let unsubscribed=0,fail=false;const requests=[];
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/client-test',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'synthetic',auth:'synthetic'}};},async unsubscribe(){unsubscribed++;return true;}};
 const registration={pushManager:{getSubscription:async()=>existing?subscription:null,subscribe:async()=>subscription}};
 const repo={state:{preferences:{},workouts:{},memory:{status:'committed',readyAt:Date.now()+10000}},snapshot(){return this.state;},async setPreferences(value){Object.assign(this.state.preferences,value);}};
 const values={window:{PushManager:class{}},navigator:{serviceWorker:{ready:Promise.resolve(registration),getRegistration:async()=>registration}},Notification:{requestPermission:async()=>'granted',permission:'granted'},location:{href:'https://venkate5hgunda.github.io/sharp/',origin:'https://venkate5hgunda.github.io'},isSecureContext:true,fetch:async(url,options)=>{requests.push({url:String(url),...options});if(fail)throw new Error('offline');return new Response('{"subscribed":true}',{status:200});}};
 values.window.Notification=values.Notification;
 for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 try {await run({repo,requests,subscription,registration,get unsubscribed(){return unsubscribed;},set fail(value){fail=value;}});} finally{for(const name of names)if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}
}
test('explicit subscription sends a management capability and minimal scheduling context',async()=>harness(async h=>{
 await subscribePush(h.repo,config);assert.equal(h.requests.length,1);assert.match(h.requests[0].headers.Authorization,/^Bearer [A-Za-z0-9_-]{43}$/);
 const body=JSON.parse(h.requests[0].body);assert.equal(body.reminderTime,'08:30');assert.ok(body.timezone);assert.equal(body.memoryReadyAt,h.repo.state.memory.readyAt);assert.equal('answers'in body,false);assert.equal('scores'in body,false);assert.equal(h.repo.state.preferences.pushSubscribed,true);
}));
test('failed registration rolls back only newly created browser subscriptions',async()=>{
 for(const existing of [false,true])await harness(async h=>{h.fail=true;await assert.rejects(subscribePush(h.repo,config),/offline/);assert.equal(h.unsubscribed,existing?0:1);assert.notEqual(h.repo.state.preferences.pushSubscribed,true);},{existing});
});
test('opt-out removes browser subscription even offline and retries server deletion later',async()=>harness(async h=>{
 h.repo.state.preferences={pushSubscribed:true,browserAlerts:true,pushManagementToken:'a'.repeat(43)};h.fail=true;
 await assert.rejects(disableAlerts(h.repo,config),/Server deletion will retry/);assert.equal(h.unsubscribed,1);assert.equal(h.repo.state.preferences.pushSubscribed,false);assert.equal(h.repo.state.preferences.pushDeletionPending,h.subscription.endpoint);
 h.fail=false;await syncPushState(h.repo,config);assert.equal(h.repo.state.preferences.pushDeletionPending,null);assert.equal(h.requests.at(-1).method,'DELETE');
},{existing:true}));
