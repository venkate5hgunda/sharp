> Update: real model tests now automatically fall back to pinned CPU inference when WebGPU is unavailable. CPU reports do not qualify the GPU browser release. See [current CPU and fallback policy](CPU_EVALUATIONS.md). The GPU failure described below remains valid historical evidence.

# Pip model qualification — current status

**Blocked, not qualified.** A fresh run in the managed environment reached WebGPU admission but reported `shader_f16_unavailable`. Secure context, IndexedDB, worker and WebGPU checks passed; the pinned model's required shader-f16 feature did not. No real-model samples were executed in that invocation. There is no substitute model, software-GPU override, historical-report substitution or automatic public enablement.

## Implemented release checks

`npm run eval:full` now requires both 21 fresh arithmetic outputs and 81 fresh coach outputs (27 contexts, three repeats). Ordinary commits use portable deterministic checks while inference is disabled and the profile is unqualified. Enabling either qualification or inference requires current full model evidence in the staged hook and CI. Both the live runner and evidence recorder reject coach reports with missing coverage, wrong repetition/order, stale prompt/validator identity, off-context wording, fallbacks, cached or synthetic sources, invalid timing, any task above ten seconds, or p95 above three seconds. The source fingerprint includes the actual coach UI, contract, evaluation, provider/runtime, gate scripts and qualification tests. The old arithmetic-only baseline cannot satisfy the new combined gate.

The interactive Model qualification benchmark runs the same two task suites. Benchmark preparation explicitly admits an unqualified model only inside evaluation. The public coach now passes `allowUnqualified: false`; a developer flag alone cannot override profile qualification.

The runner saves machine-readable capability and failed-run reports under ignored `.cache/sharp-evals/`. Failed runs do not overwrite the passing-model baseline. Their timestamps, run ID and source fingerprint make the failure inspectable without treating it as model output.

## Prompt and validation contract

Contract `2.0.0`, validator `context-allowlist-v2`:

- Input is exactly four fields: an allowed screen, domain and recent-result enum, plus integer weekly visits from zero to seven. No arbitrary prompt, player name, raw question, answer or free text is accepted.
- The system prompt asks for one JSON object with exactly one `quote` key and tells the model to copy one permitted line exactly, without paraphrase or additions.
- The output schema uses a context-specific enum of reviewed lines. Independent validation checks the exact context allowlist, 8–30 words, maximum 220 characters and no extra properties.
- Challenging rounds receive gentle explanation/strategy or break suggestions; arithmetic, reading, logic and memory have different cues. Weekly badge wording is admitted only when enough workouts were completed. Settings and backup contexts do not pressure users to train.
- This is **AI selection of reviewed contextual encouragement**, not unrestricted composition of novel quotes. That deliberate bounded contract makes invented claims impossible to display through this path. The interface labels model-selected wording accordingly.
- Raw streamed text never renders. Invalid JSON, rejected text, provider errors, cancellation and deadlines use explicitly labelled curated fallback. Hiding or closing the panel invalidates late results; closing also cancels active work.

## Regression coverage

The deterministic harness runs the complete 81-output schedule with a fixture provider and explicitly labels its source `fixture`. It cannot pass model-source validation. Unit tests cover every one of the 1,296 valid context combinations and adversarial input/output, off-context approved text, medical or intelligence assertions, extra fields, malformed JSON, stale identities, missing fixtures, changed ordering, latency failures, worker/device errors, pre-abort, in-flight abort and providers that ignore cancellation. Existing provider tests cover stalled downloads, preparation cancellation, timeout teardown and late worker completions.

These checks establish the bounded contract and harness behavior. They are not evidence of real model quality, physical-device compatibility, memory use or retained engagement.

## Completing qualification on hardware

1. Use a real WebGPU device with shader-f16 and the required buffer limits. Run `npm ci` and install Chromium. Do not add a software GPU override or change the pinned model to make the test pass.
2. Run `npm run eval:full`. Inspect `.cache/sharp-evals/latest-model-report.json`; all 102 task outputs must be real-model, accepted and meet the timing bar. Record actual device, OS/browser, network and measured preparation conditions.
3. Run cold and warm preparation, cancellation/restart, offline model reuse, cache removal, device-loss recovery and sustained use. Measure peak memory, power and thermal behavior. Qualify each intended physical surface; desktop results do not qualify Android or iOS.
4. Record passing source-matched evidence with `npm run eval:record -- .cache/sharp-evals/latest-model-report.json`. Run regressions and browser tests. Review the raw evidence before changing `MODEL_PROFILE.qualified` or public feature flags. Profile changes themselves require fresh source-bound evaluation.

No qualifying run, profile enablement or deployment has been claimed for this environment.

## Artifact and knowledge locations

- [Drive qualification archive](https://drive.google.com/drive/folders/1aPlLnwbfm6Dkf7PYsKIBOQIwHUPC_ljh)
- [Notion backlog and findings](https://app.notion.com/p/400a81c70457811aab98e1313a0d8fb4)
- [Standing development preferences](https://app.notion.com/p/400a81c7045781af9bcbc8cba16e5330)

Source, tests and these operational instructions belong in Git. Capability/failure/harness reports, screenshots, public research extracts, a sanitized verification summary and a hashed artifact manifest are archived in Drive. Source patches, workspace instructions, raw logs, browser profiles, caches, credentials and downloaded binaries remain excluded. Automatic approval review rejected a broader source-inclusive bundle; the reduced artifacts-only package was uploaded and verified.

Final verification: **95 unit tests and 17 Chromium browser tests passed**; offline manifest and whitespace checks passed. The 81-case coach fixture harness and 21-case arithmetic fixture harness passed, but the live model gate remained blocked before inference.

[Verified artifact bundle](https://drive.google.com/file/d/1xE3328zzwPJGFic-KpU7uGfbIASgsqU2/view?usp=drivesdk) · [SHA-256 manifest](https://drive.google.com/file/d/10fFZr656lda-omqxtejtsRqP7mRQbxEs/view?usp=drivesdk)

## Portable development policy

GPU availability is no longer a prerequisite for disabled-inference development commits. The staged hook runs deterministic arithmetic/coach evaluations and all staged unit tests. `eval:full` remains an explicit hardware operation; `eval:release` rejects unqualified profiles and stale or incomplete model evidence. This corrects the prior architecture that required live inference for every commit. It does not qualify or enable the current model.
