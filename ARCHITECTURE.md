# Sharp architecture

Reviewed: 2026-10-19. This describes the implemented static app; the original [analysis](docs/REDESIGN_IMPLEMENTATION_ANALYSIS.md) records the broader program and its acceptance gates.

## Application and sessions

`index.html → js/app.js → js/application.js` boots the repository before rendering Today, Exercises, Progress, Backup or Settings. Old workout/catalog/analytics hashes redirect to their new routes. Diagnostics and the guarded model benchmark are lazy route modules.

`js/session/controller.js` owns persistent state transitions. A session stores its complete ordered question/stimulus snapshots, option IDs, current round/position, phase and owner lease. Attempt IDs are derived from session, round and position; repeated answer and commit calls cannot apply twice. Explicit takeover invalidates the old owner. A page reload rotates ownership using the previous page ID without a 45-second wait.

`js/views/session-view.js` is shared by the circuit and individual exercises. Scoped timers/listeners stop on route exit. Quiz feedback persists until Next. Hidden/paused time is separate from monotonic active response time; reading has a separate phase. Interrupted visual exposure restarts the current unscored trial. Pattern scoring uses F1 partial credit; forward Corsi uses exact sequence accuracy. Practice cannot alter ratings/streaks. Untimed Corsi advances blocks manually.

Delayed memory commits an exact target/foil snapshot with a six-hour interval or three-minute practice interval. Readiness uses the stored wall-clock deadline. Recognition and exact-word free recall are separate modes; free recall makes subsequent recognition practice-only. Migrated sets without foils are also unrated. Actual delay is retained rather than relabelled as six-hour evidence.

## Transactional persistence and migration

`js/persistence/repository.js` uses IndexedDB database `sharp-progress-v2`, schema version 1, with a `state` object store and one version-2 aggregate. The aggregate contains preferences, session checkpoints, attempts, committed rounds/workouts, memory, imported content, legacy archive, diagnostics/traces/outbox and optional validated-result cache.

All mutations read the latest aggregate inside one read/write transaction and acknowledge only `transaction.complete`. Synchronous mutators prevent a transaction escaping across awaits. Write failures abort without partial commits. BroadcastChannel refreshes other tabs and propagates sharing opt-out. Upgrade blocking/version changes show recovery guidance.

The single aggregate is a deliberate correctness-first departure from the proposed normalized multi-store layout. It makes session, attempt and projection changes atomic, at the cost of cloning more data on each write. Large-history performance has not been qualified; normalization/indexing should precede very large histories. There is no silent volatile-storage fallback for training.

Before migration, a pending legacy restore journal is recovered. Migration copies every `sharp:*` raw value, computes an archive digest, validates known records, quarantines malformed keys and copies valid preferences, ratings, custom content and committed delayed memory. Existing IndexedDB state wins on retries. Legacy storage is retained until explicit reset. UTC legacy streak/history labels remain separate from new local-date evidence.

## Backups and imports

`js/persistence/backup-v2.js` exports schema 2 with SHA-256 over the document excluding its hash. This detects accidental corruption, not authenticity. V2 imports are capped at 20 MiB; legacy v1 retains its 5 MiB validator limit. Unsupported schemas, unsafe fields, invalid checkpoints, mismatched responses/scores, missing references and contradictory round evidence fail before a write.

Replace and merge are one aggregate transaction. A conflict preference selects a whole session and its evidence graph, avoiding an older checkpoint combined with newer answers. Distinct sessions are unioned. Ratings and streaks are projections from the selected evidence and baseline, never maximum snapshots from two devices. Restore disables sharing, purges queued uploads and invalidates old ownership. Imported content is bounded, plain text, explicitly unrated, and cannot override built-in IDs.

## Content and projections

`js/session/content.js` normalizes 24 original questions plus 300 foundation questions into stable versioned items. Immutable content is separate from attempt evidence. Selection filters domain, skill and category, then favors balanced skill coverage, low exposure and nearby tiers. It records the actual item tier and selection reason. Stored seeded option order survives reload. Arithmetic, pattern and sequence generators accept reproducible seeds; committed snapshots survive later generator changes.

`js/content/solvers.js` checks supported arithmetic, ordering, finite constraints, conditionals and truth-teller models independently. Reading questions use passage evidence and engineering review, not an automated claim of semantic proof. Two original logic errors were corrected with new content versions and solver regressions. [Coverage](docs/CURRICULUM_COVERAGE.md) discloses repetition and review limits.

`js/session/metrics.js` replays a versioned Elo-like heuristic from the migrated rating baseline. Accuracy is total correct eligible binary responses divided by eligible responses. Pattern F1 stays separate. Overall daily snapshots average all five current domain ratings. Only completed non-practice circuits qualify a local completion-date streak. Comparable trends require 20 responses in the same game/skill/tier/content-version/input/timing slice; correct-time windows need five correct responses each. Legacy averages are not presented as attempt-level evidence.

## Offline shell and reminders

`scripts/build-offline-manifest.mjs` hashes the complete local app/data graph. `sw.js` installs that graph in a scope-owned shell cache and serves one snapshot without individual background revalidation. Updates wait for existing tabs to close. Cleanup removes only owned old shell caches and exact legacy Sharp caches. Other apps and model caches survive.

The optional WebLLM client/worker bundles are excluded from this graph. They have a separate cache populated only after an explicit, deployment-enabled download choice. The vendor runtime owns weight/library caches. Cross-origin downloads never enter the app shell cache.

Foreground reminders use explicit preferences, readiness and per-day deduplication. Calendar export supplies local recurring events with alarms. No permission prompt or unreliable closed-app notification promise is part of startup.

## Optional intelligence and observability

All flags in `js/core/feature-flags.js` are false, immutable deployment choices. URL/localStorage values cannot enable them. `js/intelligence/service.js` uses a stub by default, exact arithmetic validators, versioned prompts, bounded deadlines/cancellation, validated caching, local traces and curated fallback. No generated answer reaches scored training.

A pinned WebLLM provider, dedicated worker and explicit benchmark screen exist for a future physical-device pilot. Capability checks are advisory and release all probe resources. The runtime is absent from the disabled boot path. [Operations](docs/INTELLIGENCE_OPERATIONS.md) documents artifact sources, sizes, evaluation and activation gates.

The diagnostics broker records allowlisted bounded metadata locally. An optional consent-gated outbox has expiry, a cross-tab lease, retries with backoff/jitter and a 20-event daily attempt budget. Flag-off creates no transport. The manual PostHog mapping uses a public ingestion key only; no SDK autocapture, cookies, replay or persistent player identity. Raw prompt/output sharing is unimplemented and disabled. A developer-machine Langfuse importer defaults to a sanitized dry run; secret keys never enter the app.
