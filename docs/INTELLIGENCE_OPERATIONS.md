# Intelligence and diagnostics operations

Release date: 2026-10-19. All inference and remote-sharing deployment flags remain false. Core training works without these systems.

## Where the model is hosted and how it downloads

The candidate is **SmolLM2-360M-Instruct-q4f16_1-MLC**, evaluated through **@mlc-ai/web-llm 0.2.86**. It is a candidate, not an advertised supported model/device combination.

- Weights, tokenizer and configuration: [MLC Hugging Face repository](https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/tree/3a622fd89e0216e8bb10c410c007c786baa8a033), immutable revision `3a622fd89e0216e8bb10c410c007c786baa8a033`.
- Compiled WebGPU library: [MLC binary library](https://github.com/mlc-ai/binary-mlc-llm-libs/blob/00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0/web-llm-models/v0_2_86/base/SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu.wasm), immutable revision `00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0`.
- Runtime client/worker: two minified static bundles hosted with Sharp under `assets/optional-runtime/`. Their source dependency and esbuild version are exact in package-lock.json; CI rebuilds and compares the files.
- Inventory: 213,648,914 bytes of published model/library/configuration/tokenizer artifacts, about 203.8 MiB, plus 12,104,796 bytes of optional runtime scripts and transfer overhead. This is an artifact inventory, not a measured cold-download, GPU-memory or peak-memory budget. The upstream registry lists 376.06 MB VRAM; actual requirements must be measured.

With inference disabled, neither weights nor SDK bundles are fetched. The shell only caches Sharp's small provider/UI modules. After a future developer deployment enables the flag, the benchmark page additionally requires an explicit download checkbox. The provider probes secure context, an IndexedDB write, a disposable worker, WebGPU/shader-f16, coarse buffer limits and device allocation. It releases the probe worker/device. A passed probe does not prove model compatibility or available memory.

Only then does it cache/import the optional runtime and create a dedicated model worker. WebLLM fetches the pinned remote artifacts using its own model cache manager. Model weights are not copied into the shell cache, and shell upgrades preserve model caches. Download progress comes from the runtime's actual phase messages; no invented throughput/percentage is displayed. Cancellation destroys a preparation worker. A later attempt can reuse completed artifacts, but interrupted transfers may restart. Remove-model uses the vendor cache API and deletes only Sharp's optional runtime cache; training progress survives.

Runtime references: [WebLLM basic usage](https://webllm.mlc.ai/docs/user/basic_usage.html), [workers/cache management](https://webllm.mlc.ai/docs/user/advanced_usage.html). The manifest in `js/intelligence/model-manifest.js` is the executable release contract. Upstream documentation alone does not qualify this pinned candidate. Preserve upstream notices before redistributing artifacts; weights are referenced remotely rather than committed.

## One model across surfaces

Use **SmolLM2 360M, q4f16_1**, with the same pinned weights, runtime, 1,024-token context, 128-token output limit and prompt on every target. There is no platform model picker, automatic upgrade, alternate download or cloud fallback. `modelAppConfig()` accepts only the shared profile.

| Surface | Model | Admission |
| --- | --- | --- |
| Desktop browser | Shared SmolLM2 360M | Secure context, storage, worker, WebGPU/shader-f16 and buffer/device probes |
| Android browser / installed PWA | Same artifacts and settings | Same capability checks; physical Android qualification pending |
| iPhone/iPad browser / installed PWA | Same artifacts and settings | Same capability checks; physical iOS/iPadOS qualification pending |
| Unsupported or resource-limited device | Curated exercises | No alternate LLM or remote inference |

Browser/PWA packaging never selects a model by OS or user agent. [WebLLM requires a WebGPU-compatible browser](https://webllm.mlc.ai/docs/user/get_started.html); API availability alone is insufficient to promise this model works on every target device. Qualify the single model on each target surface before enabling public inference. If a target fails, fix the shared configuration or keep inference unavailable there; do not quietly introduce a second model. Training stays available everywhere the core PWA works.

## Commit evaluation gate

Ordinary development and hardware qualification are separate gates. A missing GPU must not block commits that keep public inference disabled and the profile unqualified.

- **Every commit:** check a temporary checkout of the Git index, run all 21 arithmetic and 81 coach deterministic fixture cases, and run the staged unit suite. Unstaged changes cannot make a staged failure pass. No Chromium launch, GPU probe or model download occurs in this mode.
- **Enabling public inference or setting `MODEL_PROFILE.qualified`:** the staged hook and CI require current full real-model arithmetic and coach evidence matching the source fingerprint, profile, prompt, validator, fixture coverage, timing and source identity. An enabled flag with an unqualified profile is rejected. Missing, stale or synthetic evidence blocks these commits even on a machine without a GPU.
- **`npm run eval:full`:** explicit fresh hardware qualification, 21 arithmetic and 81 coach outputs. This fails when hardware is unsupported and never substitutes fixtures or historical reports. Its failure does not prevent disabled-feature development commits.
- **`npm run eval:check` / `eval:regression`:** portable deterministic checks plus release-policy enforcement. **`eval:release`** additionally requires a qualified profile and full source-matched evidence. No environment variable disables release checks.

Install hooks with `npm run hooks:install`. The installer preserves custom hooks. The tracked hook checks staged code, then the staged unit suite; it never changes or auto-stages the index. Hosted CI runs unit, evaluation-policy, offline, browser and accessibility checks; it does not claim live model execution.

On supported hardware, use `npm run eval:full`, inspect `.cache/sharp-evals/latest-model-report.json`, then record passing evidence with `npm run eval:record -- .cache/sharp-evals/latest-model-report.json`. The recorder requires full arithmetic and coach results; partial, wrong-source and stale reports fail. A passing live run is not required to have an already recorded baseline: recording is the next step, avoiding a circular dependency.

The hardware runner uses a separate browser cache and localhost-only origin, bounded preparation/task deadlines and fresh invocation identifiers. Only explicit qualification creates a browser or downloads pinned artifacts. Source fingerprints cover transitive model/coach dependencies and gate policy. Physical surface, offline reuse and sustained resource qualification remain necessary before declaring support.

## Coach qualification update (2026-10-21)

Explicit hardware qualification also requires 81 fresh contextual coach outputs. Portable commit checks use labelled fixtures. Prior arithmetic-only evidence is insufficient. The coach uses context-specific reviewed output allowlists and cannot bypass profile qualification. The current environment failed shader-f16 admission; public inference remains disabled. See [current qualification contract, evidence and reproduction](MODEL_QUALIFICATION.md). The arithmetic-only run totals elsewhere in this document describe the earlier baseline.

## Task contract and safe fallback

Only `arithmetic-explanation` is registered. Its input is a bounded, independently recomputed integer operation; arbitrary player/imported text is rejected. The output is exact JSON with the correct numeric answer and one of two presentation styles. Text displayed from that result is composed deterministically. This deliberately narrow fixture task does not introduce generated scored questions into games.

The service owns request identity, one active task, a maximum 10-second task deadline, cancellation, JSON/schema/semantic validation and curated fallback. A fallback is never counted as an accepted provider result. Cached results are revalidated; identity includes canonical input, prompt/system/schema/validator version, model/runtime artifact identity, decoding and locale. Cache retention is seven days, at most 100 entries. Local traces retain metadata, not arbitrary raw prompts or output. Evaluation can retain approved synthetic numeric fixture input locally to reproduce a failure.

The optional provider has a 180-second deadline covering the complete probe/cache/download/import/worker preparation, a two-failure preparation limit per provider instance, cancellation, device-loss teardown and recoverable status. Cancellation aborts runtime requests and terminates a generating worker; late preparation completions cannot make a cancelled provider ready. Streamed tokens are collected privately; only complete, validated JSON is accepted. Reports include observed total latency/TTFT/generation time and runtime-reported decode throughput where supplied. The screen does not promise a qualified model.

## Evaluate and reproduce

Open Settings → Developer tools. Run Golden (four cases) and Holdout (three cases), each repeated three times. Test success, invalid JSON, wrong answer, timeout, device loss, worker termination and storage failure. Download the report; fallback counts must remain distinct from acceptance. Export the latest approved fixture as a regression after recording a problem reason.

The same 21-case suite runs locally in Node tests. Browser tests verify the actual evaluation rendering and disabled download controls in Chromium and mobile WebKit. A stub report measures the harness, not model quality.

Prepare an isolated pilot with `npm run prepare:inference-pilot`. It copies static app assets and the non-secret source inputs needed to fingerprint the benchmark into a new temporary directory, enables only browser inference there and regenerates the complete offline manifest. Release files, generated scored items and remote-sharing flags remain unchanged. Serve the printed directory with `python3 -m http.server 8085 --bind 127.0.0.1 --directory /path/printed/by/the/command`, then open `http://127.0.0.1:8085/#/model`. Download still requires the checkbox and button. Close pilot tabs and stop the server after testing. Do not deploy the pilot directory as the public app.

Record device/OS/browser, exact profile pins, network conditions, cold preparation time and bytes, warm start, TTFT, generation p50/p95, accepted/fallback rates, cancellation, hidden-tab handling, cache removal, offline reuse, device loss, repeated/sustained execution, memory/power observations and thermal behavior. Run all 21 fixtures plus independently reviewed additions. Attach raw reports and declare each supported profile; do not extrapolate mobile support from desktop or emulation. No complete physical profile is qualified by this release.

The current source-bound baseline is [`evals/model-baseline.json`](../evals/model-baseline.json): an automated headless Chromium 156 full run on 2026-10-20 accepted 21/21 actual model outputs, zero fallbacks, preparation 10,069 ms with a new browser cache, task p50/p95 100/108 ms, maximum 1,838 ms. Its fingerprint covers 44 source/runtime inputs. A subsequent cached-artifact smoke accepted 3/3, zero fallbacks, p95 98 ms. The [earlier interactive benchmark screenshot](validation/model-commit-gate.png) predates this automated runner.

## Desktop pilot evidence

Measured on 2026-10-19 using an actual Apple M5 Pro desktop (`Mac17,9`, 48 GiB), macOS 27.0.1 and Chrome 155.0.8059.85. The isolated local origin was `http://127.0.0.1:8085`; the production deployment remained disabled. This is real WebGPU model execution, not a stub or browser emulation.

| Run | Source | Preparation | Accepted / total | Fallbacks | Task p50 / p95 | Slowest task |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| First observed load | `df8db42` | 20,726 ms | 21 / 21 | 0 | 92 / 112 ms | 1,759 ms |
| Cached load | `76d099d` | 346 ms | 21 / 21 | 0 | 88 / 102 ms | 187 ms |
| After cancellation/restart | `76d099d` | 345 ms | 21 / 21 | 0 | 95 / 103 ms | 186 ms |

Raw reports: [first load](validation/model-desktop-initial.json), [cached load](validation/model-desktop-cached.json), [recovery](validation/model-desktop-recovery.json). [Browser screenshot](validation/model-desktop-cached.png). Every report was checked against the seven exact fixtures, three repeats, pinned profile, semantic answers and reported counts/percentiles. Outputs were all `source: model`; fallback outputs were not counted as accepted.

Observed preparation cancellation returned a cancelled status with the benchmark disabled. Re-preparation then completed and the full suite passed. Navigating back to training disposed the model; a new math response (26 − 8 = 18) produced normal feedback. The first observed load displayed actual parameter-download progress; transfer bytes and a guaranteed empty-cache cold start were not independently measured. Its first task took 1,759 ms, so the p95 alone hides a startup outlier. The early reports' `decodeTokensPerSecond` field was an application estimate and is not used for qualification; `0d2b5da` changes subsequent reports to the runtime's decode telemetry.

These are seven narrow arithmetic/JSON fixtures, not evidence of general teaching quality. Offline model reuse, forced device loss, cache removal, long sustained runs, peak memory, power and thermals remain unmeasured. No mobile target has been tested physically. Keep the profile unqualified and public inference disabled.

## Local diagnostics and optional transport

The local ring buffers retain at most 500 allowlisted events and 100 traces. Preview/download is explicit. Events contain coarse status/reason, clamped duration and a constrained source. Window errors do not retain stack traces, URLs, messages, player answers or free text. Structured feedback is a local enum.

Remote sharing requires both a deployment flag and an explicit player choice. `js/diagnostics/config.js` currently has no key. If enabled later, only public `phc_...` PostHog ingestion keys and approved HTTPS ingestion hosts are accepted. The manual batch adapter has no vendor SDK/autocapture, cookies, session replay or persistent player identity. Per-batch identity and delivery IDs are used; remote timestamps are rounded to minutes. Hosting/ingestion providers can still see ordinary network metadata, including connection IP addresses. `$geoip_disable` prevents requested GeoIP enrichment; it does not make a network connection anonymous.

The outbox holds at most 200 events; entries expire after seven days, batches are at most ten events/64 KB, and the budget counts at most 20 attempted events per local day. A transactional 15-second lease prevents concurrent tab drains. Sends have a ten-second deadline, at most three attempts and exponential backoff with jitter. Preferences are rechecked immediately before sending. Opt-out aborts pending work, broadcasts the state change and purges queued uploads. It cannot retract a request already accepted by a server. Training does not depend on transport success.

App error sharing has a separate flag/consent. Raw prompt/output transport is **unimplemented and disabled** even though a reserved policy flag exists; setting that flag is not an implementation of payload sharing. Imported backups cannot enable sharing or preserve an upload queue. Before activating any remote deployment, configure retention/quotas in the vendor account and verify actual payloads, ingestion, deletion and retention with synthetic data. Those vendor-side checks have not been performed. No project was created or billed during implementation.

## Developer-only Langfuse import

`scripts/import-langfuse.mjs` is not part of the app asset graph. It filters and maps at most 100 approved arithmetic traces into metadata-only trace events. Arbitrary input/output and unrecognized metadata are excluded. The default prints a sanitized dry run:

```sh
node scripts/import-langfuse.mjs sharp-diagnostics.json
```

Sending is a separate deliberate developer operation:

```sh
# Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and optional LANGFUSE_HOST
# in the developer machine's environment, never in frontend files.
node scripts/import-langfuse.mjs sharp-diagnostics.json --send
```

The HTTPS ingestion call uses local environment credentials, times out after 15 seconds and treats reported partial errors as failure. Live ingestion has not been run. Do not commit `.env`, tokens or diagnostic exports containing private data. A sanitized local fixture and test usually suffice for triage without a central service.
