# Background push operations

The public app runs at https://venkate5hgunda.github.io/sharp/. The push API is deployed at https://sharp-push.cheeryowl513.chatgpt.site, public following explicit user approval. The client integration and scheduler were merged into main in PR #2. Closed-browser delivery has not yet been verified with a real opt-in device.

## Architecture and activation

`server/push/worker.js` is the canonical service source, mirrored into the Sites source repository for project `appgprj_6ad90bd1ed848191b14d387af7b429d2`. It runs as a Worker with durable R2 binding `BUCKET`. Hosting secrets contain `VAPID_PRIVATE_JWK` and an emergency `SCHEDULER_SECRET`; only `VAPID_PUBLIC_KEY` is public. Never rotate the VAPID identity casually: existing browser subscriptions bind to it.

The production identity was verified by successful manual run [39686614973](https://github.com/venkate5hgunda/sharp/actions/runs/39686614973). The scheduled workflow is enabled. Remaining device verification: opt in on a real device and verify receipt with the app closed, click destination and opt-out. iOS requires a compatible installed home-screen web app. Calendar export remains available.

The GitHub workflow runs approximately every 15 minutes, with GitHub scheduling delays possible. It obtains a short-lived GitHub OIDC token; no repository Actions secret is needed. The service verifies RS256 against GitHub's fixed JWKS issuer and pins audience, repository name and numeric ID, main branch, workflow path, event type and token lifetime. Pull requests and other branches cannot run delivery. The API audience is public; subscription capabilities and scheduler identity verification continue to protect writes and delivery.

## Consent, data and delivery policy

Settings explicitly requests notification permission and registers push separately. The API accepts HTTPS subscriptions only from supported browser push providers. A random management capability protects each record; only its SHA-256 hash is stored. CORS permits the app origin. The service never exposes a subscription list. Request size, per-IP write rate and a 1,000-record initial capacity cap limit abuse; capacity is a guardrail, not an exact concurrent quota.

Consented metadata contains the browser subscription, IANA timezone, chosen daily time, local completion date and pending recall time. No answers, scores or question history leave the app. Subscription endpoints and encryption keys remain sensitive. R2 records expire after 90 days without a client update; invalid provider subscriptions are deleted on 404/410. Hashed rate-limit entries expire after 24 hours. Opt-out immediately unsubscribes in the browser and deletes the server record; an offline deletion is retried on the next app open.

Each subscription receives at most one delivery **attempt** per local day, after its chosen time, between 08:00 and 21:00. A future recall delays the attempt; a ready recall takes priority, and a completed workout suppresses a study reminder. Compare-and-swap reserves the day before sending, preventing concurrent duplicate attempts. A transient provider failure consumes that day's attempt; the workflow reports failure rather than silently retrying and increasing frequency. Durable cron reliability and a retry policy can be revisited with production evidence.

Payloads contain only `kind: study` or `kind: recall`. The service worker selects playful copy and a local destination; remote URLs and arbitrary copy are ignored. Foreground automatic system alerts are suppressed when background push is enabled. The scheduler logs aggregate counts only.

## Verification and monitoring

Unit tests independently decrypt RFC 8291 aes128gcm messages, verify VAPID signatures, reject forged scheduler identities, check DST/quiet hours, capability authentication, offline deletion, rollback, concurrent deduplication and provider expiry. CI also runs both browser projects and the full real CPU inference gate.

Require green CI before changes. After deployment, dispatch the scheduler and inspect aggregate counts and its final success. Test a real supported device through opt-in, background receipt, deep link and opt-out. Investigate failed jobs; never publish private keys, identity tokens or subscription data in evidence archives. Browser/OS power policy and GitHub cron timing mean reminders are best effort, not precise alarms.
