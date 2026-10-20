# Release verification

Evidence recorded 2026-10-19 (America/Los_Angeles). Live app: https://venkate5hgunda.github.io/sharp/.

## Automated checks

- Local Node suite: **70/70 passed**, including persistence/migration, backup graph integrity, ownership, scoring/calendar policy, content solvers, inference validation/fallback and diagnostics privacy/outbox contracts.
- Offline dependency manifest and whitespace checks passed after the concise-copy changes.
- CI rebuilds the pinned optional runtime and checks generated bundles against the committed artifacts, checks JavaScript syntax, runs the Node suite and exercises Chromium desktop plus mobile WebKit.
- The browser suite contains **28 checks**. It covers all exercise types, a complete scored workout, feedback reload, exact-once responses, pause/exit, delayed study/recognition, backup download/restore, cross-tab ownership, held keys, installed-shell offline execution, disabled optional-runtime network access, fixture evaluations, accessibility and mobile reflow.
- Earlier complete release baseline: [CI, commit 8771003](https://github.com/venkate5hgunda/sharp/actions/runs/39362148916), 28/28 browser checks passed. [Pages deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39362148552) succeeded.
- Concise-interface verification: [CI, commit 202577f](https://github.com/venkate5hgunda/sharp/actions/runs/39367212800) passed all 70 unit and 28 browser checks; [Pages deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39367212525) succeeded. Follow-up `36dfcc8` clarifies the brief recall guide; [CI](https://github.com/venkate5hgunda/sharp/actions/runs/39367400366) and [deployment](https://github.com/venkate5hgunda/sharp/actions/runs/39367400577) track that final code change.

The first concise-copy browser run exposed assertion/race problems and a small disclosure target. Visible-text comparison now excludes collapsed explanations, memory recognition waits for the committed first question, and summaries have a minimum 44px touch height. Accessibility rules were retained.

## Live app checks

Checked the actual GitHub Pages app in Chrome, using its controls rather than modifying browser storage or invoking internal application methods:

1. Completed all four rounds of an untimed workout. Reloaded during feedback and resumed the committed checkpoint. The completed practice workout left ratings and streaks unchanged. [Circuit screenshot](validation/live-circuit-complete.png) records this earlier UI state.
2. Verified the installed-shell update boundary: the old tab displayed an update notice; closing all Sharp tabs and reopening loaded the concise interface while preserving prior practice sessions and the pending study set.
3. Verified concise Today, Exercises and Settings copy and controls. Answered a Logic question, reloaded at feedback and saw the same answer/Next state with the explanation collapsed. Opening Explanation revealed the full reasoning. Scoring details are also expandable; technical tools remain under Settings. [Current Today screenshot](validation/live-concise-today.png).
4. Reopened the five-word study set saved at 8:03:05 PM, then completed all ten recognition responses with explicit feedback/Next controls. The session finished at 100% accuracy. Progress recorded **0.96 hours actual delay**, fast-track, unrated; all five domain ratings remained 1000, with no scored responses or qualifying workouts. This validates actual elapsed retention rather than claiming the session ran exactly three minutes later. [Progress screenshot](validation/live-memory-progress.png).
5. Ran the synthetic Golden browser evaluation: **12 runs, 12 accepted stub outputs, zero fallbacks**, p95 3ms in that run. This is a stub harness result, not an actual language-model benchmark. The browser indicated that the report download completed; the downloaded file was not independently inspected, so it is not included as verified artifact evidence.
6. Ran the wrong-answer fixture on the concise release: **12 runs, zero accepted outputs, 12 curated fallbacks**, p95 1ms. Settings displayed AI and developer sharing as off; metadata-sharing controls remained disabled.

## Limits of this evidence

Automated WebKit is an emulated browser environment, not physical iPhone/iPad qualification. Actual model download/execution, cold/warm latency, memory, power, device loss and sustained use remain unqualified. Remote telemetry is disabled and actual vendor ingestion/retention configuration has not been exercised. Independent educational review and psychometric calibration remain outstanding. See [implementation progress](IMPLEMENTATION_PROGRESS.md), [curriculum coverage](CURRICULUM_COVERAGE.md) and [intelligence operations](INTELLIGENCE_OPERATIONS.md) for the precise gates.

Core training is deployed and functional with deterministic curated content. No evidence here authorizes enabling inference or remote sharing.
