// Called only by the scheduled workflow. Tokens arrive through secret environment variables.
const url = process.env.SHARP_PUSH_URL;
if (!url) throw new Error('Push scheduler is not configured.');
const target = new URL(url);
if (target.origin !== 'https://sharp-push.cheeryowl513.chatgpt.site' || target.pathname !== '/internal/tick') throw new Error('Unexpected push scheduler target.');
const issuerURL=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,issuerToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!issuerURL||!issuerToken)throw new Error('GitHub OIDC permission is required.');
const issue=new URL(issuerURL);issue.searchParams.set('audience',target.origin);
const issued=await fetch(issue,{headers:{Authorization:'Bearer '+issuerToken},signal:AbortSignal.timeout(10000)});
if(!issued.ok)throw new Error('Could not acquire a short-lived scheduler identity.');
const token=(await issued.json()).value;if(typeof token!=='string')throw new Error('Invalid scheduler identity.');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const totals = { processed: 0, sent: 0, expired: 0, failed: 0, skipped: 0 };
let cursor;
for (let page = 0; page < 20; page++) {
  const current = new URL(target); if (cursor) current.searchParams.set('cursor', cursor);
  const response = await fetch(current, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(120000), redirect: 'error' });
  if (!response.ok) throw new Error('Push scheduler HTTP ' + response.status);
  const result = await response.json();
  for (const key of Object.keys(totals)) { if (!Number.isSafeInteger(result[key]) || result[key] < 0) throw new Error('Invalid scheduler result'); totals[key] += result[key]; }
  cursor = result.cursor; if (!cursor) break;
}
console.log(JSON.stringify(totals));
if (cursor) throw new Error('Scheduler page limit exceeded');
if (totals.failed) throw new Error('Some push deliveries failed; inspect aggregate counts.');
