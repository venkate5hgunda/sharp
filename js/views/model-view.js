import { createSessionScope } from '../core/session-scope.js';
import { FEATURES } from '../core/feature-flags.js';
import { MODEL_PROFILE } from '../intelligence/model-manifest.js';
import { WebLLMProvider } from '../intelligence/webllm-provider.js';
import { IntelligenceService } from '../intelligence/service.js';
import { runEvaluation, GOLDEN, HOLDOUT } from '../intelligence/evaluation.js';
import { downloadJSON } from '../persistence/backup-v2.js';
export function renderModel(container, repo) {
  const scope = createSessionScope(); let service, provider, abort, report;
  scope.addCleanup(() => { abort?.abort(); service?.dispose(); });
  container.innerHTML = `<h1 class="view-title">Model benchmark</h1><div class="workout-card"><h2>Evaluation candidate</h2><p>${FEATURES.browserInference ? 'Local pilot only. No device qualified.' : 'Inference is off. Downloads are disabled.'}</p>
    <details><summary>Model &amp; download</summary><p>${MODEL_PROFILE.modelId}. ${(MODEL_PROFILE.artifactBytes / 1048576).toFixed(1)} MiB artifacts + 12 MiB runtime.</p><p>Pinned weights: Hugging Face. Pinned library: MLC on GitHub. Requires WebGPU with shader-f16. Compatibility checks do not guarantee a successful load. This benchmark does not affect training or ratings.</p></details>
    <label><input id="modelConsent" type="checkbox" ${FEATURES.browserInference ? '' : 'disabled'}> Download this candidate for a foreground local benchmark</label>
    <p><button id="prepareModel" class="btn btn-primary" ${FEATURES.browserInference ? '' : 'disabled'}>Download &amp; prepare candidate</button><button id="cancelModel" class="btn btn-outline" disabled>Cancel work</button></p>
    <p id="modelStatus" role="status"></p><button id="benchmarkModel" class="btn btn-primary" disabled>Run golden + holdout benchmark</button><button id="downloadBenchmark" class="btn btn-outline" hidden>Download model report</button><button id="removeModel" class="btn btn-outline" ${FEATURES.browserInference ? '' : 'disabled'}>Remove this model cache</button><details><summary>Cache &amp; cancellation</summary><p>Cancel stops the worker. Completed artifacts may be reused; interrupted downloads may restart. Removing the model preserves training progress.</p></details><details id="benchmarkPreview" hidden><summary>Report</summary><pre id="benchmarkJSON"></pre></details></div>`;
  const status = container.querySelector('#modelStatus');
  const showReport = () => { container.querySelector('#benchmarkPreview').hidden = false; container.querySelector('#benchmarkJSON').textContent = JSON.stringify(report, null, 2); };
  const busy = (active) => {
    container.querySelector('#prepareModel').disabled = active || !FEATURES.browserInference;
    container.querySelector('#removeModel').disabled = active || !FEATURES.browserInference;
    container.querySelector('#cancelModel').disabled = !active;
  };
  scope.listen(container.querySelector('#prepareModel'), 'click', async () => {
    if (!FEATURES.browserInference || !container.querySelector('#modelConsent').checked) { status.textContent = 'Choose the explicit download option first.'; return; }
    abort = new AbortController(); service?.dispose(); provider = new WebLLMProvider(); service = new IntelligenceService({ repo, provider });
    busy(true); container.querySelector('#benchmarkModel').disabled = true;
    container.querySelector('#downloadBenchmark').hidden = true; container.querySelector('#benchmarkPreview').hidden = true;
    try { const prepared = await service.prepare(MODEL_PROFILE, { consent: true, allowUnqualified: true, signal: abort.signal,
      onProgress: (p) => { if (scope.active) status.textContent = `${p.phase}: ${p.text || 'Preparing model resources'}`; } });
      report = { version: 'sharp-model-benchmark-v2', profile: MODEL_PROFILE, preparation: prepared }; if (scope.active) { status.textContent = `Ready in ${prepared.loadMs}ms. Candidate unqualified.`; container.querySelector('#benchmarkModel').disabled = false; showReport(); }
    } catch (e) { if (scope.active) status.textContent = `Preparation stopped: ${e.message}. Curated exercises remain available.`; }
    finally { if (scope.active) busy(false); }
  });
  scope.listen(container.querySelector('#benchmarkModel'), 'click', async () => {
    abort = new AbortController(); container.querySelector('#benchmarkModel').disabled = true; busy(true);
    try { report.evaluation = await runEvaluation(service, { dataset: [...GOLDEN, ...HOLDOUT], repeats: 3, signal: abort.signal,
      onResult: (r) => { if (scope.active) status.textContent = `${r.fixtureId}: ${r.source}, ${r.timings.totalMs}ms`; } });
      if (scope.active) { status.textContent = `${report.evaluation.accepted}/${report.evaluation.count} accepted · ${report.evaluation.fallbackCount} fallbacks. Candidate unqualified.`; container.querySelector('#downloadBenchmark').hidden = false; showReport(); }
    } catch (e) { if (scope.active) status.textContent = e.message; }
    finally { if (scope.active) { container.querySelector('#benchmarkModel').disabled = provider.getStatus().state !== 'ready'; busy(false); } }
  });
  scope.listen(container.querySelector('#cancelModel'), 'click', () => abort?.abort());
  scope.listen(document, 'visibilitychange', () => { if (document.hidden) { abort?.abort(); provider?.dispose(); container.querySelector('#benchmarkModel').disabled = true; if (FEATURES.browserInference) status.textContent = 'Paused. Prepare the model again.'; } });
  scope.listen(container.querySelector('#downloadBenchmark'), 'click', () => downloadJSON(report, 'sharp-model-benchmark.json'));
  scope.listen(container.querySelector('#removeModel'), 'click', async () => { try { provider ||= new WebLLMProvider(); await provider.removeModel(); if (scope.active) { status.textContent = 'Model removed. Progress is unchanged.'; container.querySelector('#benchmarkModel').disabled = true; } } catch (e) { if (scope.active) status.textContent = e.message; } });
  return scope.dispose;
}
