# Release verification

Evidence recorded 2026-10-19 (America/Los_Angeles). Live app: https://venkate5hgunda.github.io/sharp/.

## Automated checks

- Local Node suite: **84/84 passed**, including persistence/migration, backup graph integrity, ownership, scoring/calendar policy, content solvers, inference validation/fallback, diagnostics privacy/outbox, isolated pilot builds and model preparation/cancellation/pin/timing regressions.
- Offline dependency manifest and whitespace checks passed after the concise-copy changes.
- CI rebuilds the pinned optional runtime and checks generated bundles against the committed artifacts, checks JavaScript syntax, runs the Node suite and exercises Chromium desktop plus mobile WebKit.
- The browser suite contains **28 checks**. It covers all exercise types, a complete scored workout, feedback reload, exact-once responses, pause/exit, delayed study/recognition, backup download/restore, cross-tab ownership, held keys, installed-shell offline execution, disabled optional-runtime network access, fixture evaluations, accessibility and mobile reflow.
- Earlier complete release baseline: [CI, commit 8771003](https://github.com/venkate5hgunda/sharp/actions/runs/39362148916), 28/28 browser checks passed. [Pages deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39362148552) succeeded.
- Concise-interface baseline: [CI, commit df8db42](https://github.com/venkate5hgunda/sharp/actions/runs/39367719361) passed all 70 unit and 28 browser checks. [Deployment f3514ff](https://github.com/venkate5hgunda/sharp/actions/runs/39367602464) shipped the same application source. Intermediate failed/superseded runs are not the final baseline.
- Desktop pilot hardening: [CI, commit 76d099d](https://github.com/venkate5hgunda/sharp/actions/runs/39368532701) passed 76 unit and 28 browser checks; [deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39368531795) succeeded. Follow-up `0d2b5da` adds immutable-profile enforcement and runtime decode telemetry: [CI](https://github.com/venkate5hgunda/sharp/actions/runs/39368805952), [deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39368805596).

The first concise-copy browser run exposed assertion/race problems and a small disclosure target. Visible-text comparison now excludes collapsed explanations, memory recognition waits for the committed first question, and summaries have a minimum 44px touch height. Accessibility rules were retained.

A subsequent run exposed a test race in the held-Enter regression: it sent Enter before the asynchronous Begin transition had focused the first answer. That test now waits for answer focus before exercising held-key behavior. This changes test synchronization without relaxing the held-key assertions.

## Commit gate verification

The pre-commit hook now requires fresh real inference on every invocation: three smoke cases, or all 21 cases for model/prompt/inference changes. It evaluates the staged snapshot in isolated headless Chromium with cached model downloads, bypassing task-result caches. A fresh run ID, invocation time window, expected scope and exact source fingerprint prevent earlier reports or stub outputs from satisfying the live gate.

Verified on 2026-10-20: an initial automated full run accepted **21/21**, zero fallbacks, p95 **108 ms**, preparation **10,069 ms** (new browser cache). A subsequent cached-artifact smoke accepted **3/3**, zero fallbacks, p95 **98 ms**. The full report is [committed](../evals/model-baseline.json), bound to 44 source/runtime inputs. Chromium 156.0.8078.4 ran headlessly on this desktop. Missing Chromium was observed to block the command; no saved-report fallback occurred. Installing the pinned browser enabled the actual run.

Disposable Git tests verify real-mode invocation, partial staging, unstaged invalid model code, staged model additions/deletions, index preservation and commit rejection. Freshness tests reject a previous invocation ID, stale timestamps, wrong scope and stub sources. All **84 unit tests** and **23 focused regression tests** pass locally. Hosted CI explicitly runs deterministic regression plus committed source-matched model evidence; it does not claim a hosted GPU run. The shared model/configuration and pending mobile qualification are unchanged.

## Live app checks

Checked the actual GitHub Pages app in Chrome, using its controls rather than modifying browser storage or invoking internal application methods:

1. Completed all four rounds of an untimed workout. Reloaded during feedback and resumed the committed checkpoint. The completed practice workout left ratings and streaks unchanged. [Circuit screenshot](validation/live-circuit-complete.png) records this earlier UI state.
2. Verified the installed-shell update boundary: the old tab displayed an update notice; closing all Sharp tabs and reopening loaded the concise interface while preserving prior practice sessions and the pending study set.
3. Verified concise Today, Exercises and Settings copy and controls. Answered a Logic question, reloaded at feedback and saw the same answer/Next state with the explanation collapsed. Opening Explanation revealed the full reasoning. Scoring details are also expandable; technical tools remain under Settings. [Current Today screenshot](validation/live-concise-today.png).
4. Reopened the five-word study set saved at 8:03:05 PM, then completed all ten recognition responses with explicit feedback/Next controls. The session finished at 100% accuracy. Progress recorded **0.96 hours actual delay**, fast-track, unrated; all five domain ratings remained 1000, with no scored responses or qualifying workouts. This validates actual elapsed retention rather than claiming the session ran exactly three minutes later. [Progress screenshot](validation/live-memory-progress.png).
5. Ran the synthetic Golden browser evaluation: **12 runs, 12 accepted stub outputs, zero fallbacks**, p95 3ms in that run. This is a stub harness result, not an actual language-model benchmark. The browser indicated that the report download completed; the downloaded file was not independently inspected, so it is not included as verified artifact evidence.
6. Ran the wrong-answer fixture on the concise release: **12 runs, zero accepted outputs, 12 curated fallbacks**, p95 1ms. Settings displayed AI and developer sharing as off; metadata-sharing controls remained disabled.

## Limits of this evidence

Automated WebKit is an emulated browser environment, not physical iPhone/iPad qualification. Actual desktop model download/execution, cached startup and cancellation/recovery now have [raw pilot evidence](INTELLIGENCE_OPERATIONS.md#desktop-pilot-evidence); this is a limited desktop experiment, not full device qualification. Offline model reuse, memory, power, device loss and sustained use remain unqualified. Remote telemetry is disabled and actual vendor ingestion/retention configuration has not been exercised. Independent educational review and psychometric calibration remain outstanding. See [implementation progress](IMPLEMENTATION_PROGRESS.md), [curriculum coverage](CURRICULUM_COVERAGE.md) and [intelligence operations](INTELLIGENCE_OPERATIONS.md) for the precise gates.

Core training is deployed and functional with deterministic curated content. No evidence here authorizes enabling inference or remote sharing.
