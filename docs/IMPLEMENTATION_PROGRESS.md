# Implementation progress

Updated 2026-10-19. Reference: [analysis and acceptance criteria](REDESIGN_IMPLEMENTATION_ANALYSIS.md).

The core local-first release (Phases 0–4) is implemented. Phase 5 now has measured desktop model execution, cached startup and cancellation/recovery evidence from an isolated local pilot. Phase 6 transport/consent/import infrastructure is mock-tested. **Full device qualification, live vendor-account validation and independent educational review remain gates; public inference and all remote sharing stay disabled.**

| Stage | Pushed commit | Delivery |
| --- | --- | --- |
| Planning | `afdcb4d` | Full source analysis, contracts and phased plan |
| Offline | `089f445` | Complete installed shell, cache ownership and coherent update boundary |
| Legacy backup/import | `2bb83c4` | Strict validation, bounded imports, durable rollback journal |
| Lifecycle foundation | `e69b623` | Scoped cleanup, identity, local calendar, disabled deployment flags |
| Feedback UX | `151e0d8` | Explicit Next, persistent explanations and focus |
| Transactional storage | `95832d3` | IndexedDB, raw legacy archive, quarantine and migration retry |
| Shared app/session UX | `16b1535` | Navigation, onboarding, shared sessions, checkpoint/ownership, backup v2, progress and reminders |
| Curriculum | `55641d7` | 300 new items, 30 total memory sets, independent solvers, filters and exposure selection |
| Intelligence/diagnostics | `9681294` | Pinned optional runtime, stub/failure evaluation, validated fallback/cache, local traces, guarded sharing and transport |
| Restore evidence | `8773c88` | Strict checkpoint/response/score graph validation, coherent conflict merge |
| Answer review/qualification | `8771003` | Corrected original ordering/biconditional puzzles; completion-date streaks; held-key and cross-tab browser regressions |
| Concise interface | `9ca5677`, `202577f` | Shortened primary screens; explanations and technical details expand on demand; accessible disclosure targets and visible-feedback reload checks |
| Desktop inference pilot | `76d099d`, `0d2b5da` | Isolated pilot builder, whole-preparation deadlines, worker teardown on cancellation, immutable artifact pins and runtime decode telemetry; actual desktop model reports |

## Delivered acceptance coverage

- Phase 0: cache dependency coverage/ownership, offline installed-shell execution, strict v1/v2 imports, flag-off silence.
- Phase 1: all seven exercise entries use the shared persistent session experience or the delayed-memory study view; full circuit, pause/exit/reload, idempotent commits, explicit feedback, native dialog lifecycle, keyboard handling and mobile reflow.
- Phase 2: transactional migration/restore, complete committed memory snapshot, imported-content isolation, solver checks, stable options and exposed nearby-tier selection. Curriculum counts and editorial limitations are [published](CURRICULUM_COVERAGE.md).
- Phase 3: attempt-level metrics with counts, actual retention interval, separate practice/partial credit, comparable slices, local diagnostics export, foreground/calendar reminders.
- Phase 4: stub/provider contract, bounded cancellation/deadlines, golden and holdout repeats, failure fixtures, validated result cache, downloadable browser evaluation and regression fixture.
- Phase 5 implementation: exact runtime/model/library pins, opt-in download/cache controls, dedicated worker, advisory resource probe, cancellation/device-loss handling and benchmark reports. Actual desktop execution and cached cancellation/recovery were measured; **no complete device profile is qualified**. See [desktop evidence](INTELLIGENCE_OPERATIONS.md#desktop-pilot-evidence).
- Phase 6 implementation: allowlisted mock-first outbox, separate deployment/consent controls, preview, redaction, expiry/caps/backoff, cross-tab ownership/opt-out, public-key transport adapter and developer-only Langfuse import. **No vendor ingestion or retention setting has been activated or verified.**

## Qualification work that still needs external evidence

1. Extend the recorded desktop pilot with offline-cache, device-loss, sustained-use, memory/power and thermal measurements. Run the full matrix on physical iPhone/iPad and Android targets. Supply this evidence before enabling a profile. Emulated WebKit is not a physical iOS qualification.
2. Review the authored curriculum with an independent educational/editorial reviewer; calibrate tiers and strengthen shallow/template-like distractors. The engineering answer review is complete; human pedagogical review and a ten-items-per-priority-skill/tier target are not claimed.
3. If remote sharing is wanted, configure a public project key and vendor retention/quotas, inspect actual ingestion with a separately enabled development deployment, then review consent language. Keep Langfuse secrets on the developer machine. No production player-data upload is necessary to qualify core training.
4. The 1,000-item expansion, rule-switch/N-back games, richer mastery scheduling and psychometric calibration are later roadmap work, not advertised features of this release.

[Release verification](IMPLEMENTATION_VERIFICATION.md) contains test results, CI/deployment links and live-app evidence. Earlier Phase 0/feedback documents are historical stage reports, not the current completion inventory.
