# Reliability foundation verification

Date: 2026-10-19. Scope: Phase 0 of the [implementation analysis](REDESIGN_IMPLEMENTATION_ANALYSIS.md). This is the first implementation delivery; the complete redesign remains in progress.

## Delivered behavior

- The generated offline manifest covers local modules, datasets, styles and assets. Hidden files such as `.DS_Store` are excluded. CI rejects a stale manifest.
- A service worker serves a coherent application snapshot. New releases wait for existing tabs to close. Cleanup preserves unrelated applications, other scopes and future model caches.
- Backup validation rejects checksum mismatches, unsupported schemas, invalid record shapes and unsafe content. Legacy backups without a checksum carry an explicit warning. The existing checksum detects accidental corruption; it does not authenticate a file.
- Restores journal the original localStorage snapshot before writing. A failed write rolls back, and an interrupted restore recovers on the next storage access. A full quota can prevent creating the journal; in that case replacement does not begin. Recovery that remains write-blocked is reported as pending rather than successful.
- Question packs are validated as a whole before saving. Correct answer `0` is accepted. Invalid options, tiers, plain-text fields, duplicate pack IDs and built-in ID replacements are rejected. Imported text is escaped during rendering, including attribute values.
- All seven exercise entry points return an idempotent disposer. Game timers, listeners and completion callbacks belong to a session scope. The router and workout circuit retain and invoke these disposers. Scoring/submission guards prevent repeated completion writes within a mounted game.
- Choice shortcuts survive unrelated keys, ignore editing fields and modifiers, and are removed after answering or leaving the game. Standalone Done buttons return to the catalog.
- New round IDs and delayed-memory IDs use UUIDs when available, with an offline fallback. IDs survive export and import unchanged.
- New round dates, backup dates and reminder day checks use local calendar keys. New streaks use `local-v1`. Existing streaks retain `utc-legacy` until a versioned migration can reconcile their history; historical labels are not guessed or rewritten. A merge between populated streaks using different policies fails before writing.
- Deployment configuration contains five immutable, disabled flags: inference, developer telemetry, prompt payload sharing, app diagnostics, and generated scored items. This release contains no model runtime or diagnostics SDK/transport. Provider interfaces and diagnostics infrastructure remain Phase 4 work.

## Automated evidence

Run from the repository root:

```sh
npm run build:offline
npm test
npm run check:offline
```

The Node suite passes **39/39** tests. JavaScript and module syntax checks and `git diff --check` also pass.

| Area | Regression coverage |
| --- | --- |
| Offline | Full module dependency graph, manifest freshness, hidden-file exclusion, scope-owned cache deletion, cached fetch without background revalidation |
| Backup | Export/checksum round trip, damaged and empty checksums, future/fractional schema versions, malformed and unsafe records, restore/merge behavior |
| Storage failures | Failure after replacement begins, quota exhausted before journaling, recovery after interrupted restore, unrelated-origin keys preserved |
| Content | Numeric-zero answers, malformed options and tiers, markup rejection, reserved IDs, whole-pack rejection, text escaping |
| Lifecycle | Timers already queued when disposed, nested timers, listener removal, once-only completion, parent/child disposal, real router cleanup contract with mounted-view fixtures |
| Calendar and identity | Dates on both sides of UTC, spring/fall DST, actual streak completion across DST, legacy calendar preservation, calendar-policy merge rejection, rapid ID creation |
| Flags | All defaults false and frozen |

The route regression uses the real router with controlled view fixtures. It proves disposal ownership and prevents a timer/keyboard callback from committing after route-away; it does not emulate every timed phase of every exercise.

## Browser checks

Manual checks used desktop Chrome and a local Python HTTP server at `127.0.0.1:8080`.

| Check | Observed result |
| --- | --- |
| Open and leave each exercise | All seven entry points rendered and returned to the catalog |
| Logic keyboard input | Tab followed by `1` still answered the question and showed feedback |
| Complete arithmetic using keyboard | Eight questions reached the result screen; Done returned to the catalog; Analytics showed exactly one completed round |
| Workout cancellation | Started the pattern exercise inside the circuit, then navigated to Analytics; no extra completed round or streak was added |
| Shell update | Browser reported an update ready; closing the previous tab allowed activation before reopening |
| Installed-shell reload | After stopping the local HTTP server, reloading still rendered the app |
| Cached content | With the server stopped, logic, story math, comprehension and delayed-memory screens still opened |
| Browser console | No app warnings or errors during the exercise and cancellation checks |

Stopping the server checks independence from the app origin. It is not a full device-network isolation test: the existing external font request remains outside the application shell, with CSS fallback fonts available. No diagnostics vendor or model runtime is included in the app.

## Remaining gates

Further delivery is tracked in [implementation progress](IMPLEMENTATION_PROGRESS.md). Remaining Phase 1 gates include dialog improvements, persistent workout checkpoints, interruption/reload recovery, cross-tab commit ownership and broader timed-phase browser coverage. The localStorage rollback journal is a compatibility measure; transactional IndexedDB persistence remains Phase 2. Legacy rating/streak merge behavior remains until projections can be rebuilt from appropriate history.

No claim is made yet about background scheduling, hidden-tab fairness, browser data eviction, crash-proof multi-tab transactions, or physical iPhone/iPad/Mac performance. These require the later implementation and qualification stages described in the plan.
