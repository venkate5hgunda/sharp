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
  container.innerHTML = `<h1 class="view-title">Optional model benchmark</h1><div class="workout-card"><h2>Evaluation candidate</h2><p>${MODEL_PROFILE.modelId}. About ${(MODEL_PROFILE.artifactBytes / 1048576).toFixed(1)} MiB model artifacts, plus about 12 MiB runtime code. Weights download from Hugging Face; the compiled library downloads from MLC’s GitHub repository. Both use pinned revisions.</p><p>Requires a compatible WebGPU adapter with shader-f16. Downloading and warm-up may fail even if the capability probe passes. This benchmark does not change game answers or ratings.</p><p>${FEATURES.browserInference ? 'Developer benchmark enabled. Device qualification is still required before advertising support.' : 'Inference deployment flag is disabled. Downloads and model execution are unavailable in this release.'}</p>
    <label><input id="modelConsent" type="checkbox" ${FEATURES.browserInference ? '' : 'disabled'}> Download this candidate for a foreground local benchmark</label>
    <p><button id="prepareModel" class="btn btn-primary" ${FEATURES.browserInference ? '' : 'disabled'}>Download &amp; prepare candidate</button><button id="cancelModel" class="btn btn-outline" disabled>Cancel work</button></p>
    <p id="modelStatus" role="status"></p><button id="benchmarkModel" class="btn btn-primary" disabled>Run golden + holdout benchmark</button><button id="downloadBenchmark" class="btn btn-outline" hidden>Download model report</button><button id="removeModel" class="btn btn-outline" ${FEATURES.browserInference ? '' : 'disabled'}>Remove this model cache</button><p>Cancellation stops the worker. A later attempt may reuse completed cached artifacts, but interrupted downloads may restart. Removing a model never deletes your training progress.</p></div>`;
  const status = container.querySelector('#modelStatus');
  scope.listen(container.querySelector('#prepareModel'), 'click', async () => {
    if (!FEATURES.browserInference || !container.querySelector('#modelConsent').checked) { status.textContent = 'Choose the explicit download option first.'; return; }
    abort = new AbortController(); provider?.dispose(); provider = new WebLLMProvider(); service = new IntelligenceService({ repo, provider });
    container.querySelector('#cancelModel').disabled = false; container.querySelector('#prepareModel').disabled = true;
    try { const prepared = await service.prepare(MODEL_PROFILE, { consent: true, allowUnqualified: true, signal: abort.signal,
      onProgress: (p) => { if (scope.active) status.textContent = `${p.phase}: ${p.text || 'Preparing model resources'}`; } });
      report = { profile: MODEL_PROFILE, preparation: prepared }; if (scope.active) { status.textContent = `Ready in ${prepared.loadMs}ms. This is an unqualified evaluation candidate.`; container.querySelector('#benchmarkModel').disabled = false; }
    } catch (e) { if (scope.active) status.textContent = `Preparation stopped: ${e.message}. Curated exercises remain available.`; }
    finally { if (scope.active) { container.querySelector('#prepareModel').disabled = false; container.querySelector('#cancelModel').disabled = true; } }
  });
  scope.listen(container.querySelector('#benchmarkModel'), 'click', async () => {
    abort = new AbortController(); container.querySelector('#benchmarkModel').disabled = true; container.querySelector('#cancelModel').disabled = false;
    try { report.evaluation = await runEvaluation(service, { dataset: [...GOLDEN, ...HOLDOUT], repeats: 3, signal: abort.signal,
      onResult: (r) => { if (scope.active) status.textContent = `${r.fixtureId}: ${r.source}, ${r.timings.totalMs}ms`; } });
      if (scope.active) { status.textContent = `${report.evaluation.accepted}/${report.evaluation.count} accepted model outputs. Review the report before qualifying any device.`; container.querySelector('#downloadBenchmark').hidden = false; }
    } catch (e) { if (scope.active) status.textContent = e.message; }
    finally { if (scope.active) { container.querySelector('#benchmarkModel').disabled = false; container.querySelector('#cancelModel').disabled = true; } }
  });
  scope.listen(container.querySelector('#cancelModel'), 'click', () => abort?.abort());
  scope.listen(document, 'visibilitychange', () => { if (document.hidden) { abort?.abort(); provider?.dispose(); } });
  scope.listen(container.querySelector('#downloadBenchmark'), 'click', () => downloadJSON(report, 'sharp-model-benchmark.json'));
  scope.listen(container.querySelector('#removeModel'), 'click', async () => { try { provider ||= new WebLLMProvider(); await provider.removeModel(); if (scope.active) { status.textContent = 'Model removed. Progress is unchanged.'; container.querySelector('#benchmarkModel').disabled = true; } } catch (e) { if (scope.active) status.textContent = e.message; } });
  return scope.dispose;
}
