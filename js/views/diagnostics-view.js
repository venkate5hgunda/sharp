import { downloadJSON } from '../persistence/backup-v2.js';
import { createSessionScope } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { DiagnosticsBroker } from '../diagnostics/broker.js';
import { IntelligenceService } from '../intelligence/service.js';
import { StubProvider } from '../intelligence/stub-provider.js';
import { runEvaluation, GOLDEN, HOLDOUT, regressionFromTrace } from '../intelligence/evaluation.js';
import { MODEL_PROFILE } from '../intelligence/model-manifest.js';
import { probeCapabilities } from '../core/capabilities.js';
import { FEATURES } from '../core/feature-flags.js';
export function renderDiagnostics(container, repo, sharedBroker) {
  const scope = createSessionScope(), broker = sharedBroker || new DiagnosticsBroker(repo); let service, abort, lastReport;
  scope.addCleanup(() => { abort?.abort(); service?.dispose(); if (!sharedBroker) broker.dispose(); });
  container.innerHTML = `<h1 class="view-title">Developer tools</h1><p>Local tests and diagnostics.</p>
    <div class="settings-card"><h2>Diagnostics</h2><p>Local metadata only. No answers or private text.</p>
    <button id="previewDiagnostics" class="btn btn-outline">Preview export</button><button id="exportDiagnostics" class="btn btn-primary">Download diagnostic JSON</button><pre id="diagnosticPreview" hidden></pre></div>
    <div class="settings-card"><h2>Sharing</h2><p>Remote telemetry: ${FEATURES.remoteDeveloperTelemetry ? 'available' : 'deployment disabled'}. Prompt payloads: ${FEATURES.remotePromptPayloads ? 'available' : 'deployment disabled'}. App diagnostics: ${FEATURES.remoteAppDiagnostics ? 'available' : 'deployment disabled'}.</p>
    <details><summary>Upload policy</summary><p>Metadata sharing sends allowlisted task status, rounded timestamps, duration and delivery IDs to PostHog. No answers, prompt text, output text, persistent player identifier or progress is sent. Up to 20 events per day; pending events expire after seven days. Vendor retention must be configured before enabling a deployment.</p></details>
    <p><label><input id="shareErrors" type="checkbox" ${FEATURES.remoteAppDiagnostics ? '' : 'disabled'}> Also share coarse app error codes</label></p>
    <button id="enableSharing" class="btn btn-outline" ${FEATURES.remoteDeveloperTelemetry && broker.transport ? '' : 'disabled'}>Enable metadata sharing</button>
    <button id="previewSharing" class="btn btn-outline">Preview queued upload</button><button id="disableSharing" class="btn btn-outline">Disable sharing &amp; purge upload queue</button><p id="sharingStatus" role="status"></p><pre id="sharingPreview" hidden></pre></div>
    <div class="settings-card"><h2>Evaluation</h2><p>Synthetic arithmetic tests. No model download.</p>
    <label for="evalScenario">Scenario</label><select id="evalScenario">${['success', 'invalid_json', 'wrong_answer', 'timeout', 'device_lost', 'worker_terminated', 'storage_failed'].map((s) => `<option>${s}</option>`).join('')}</select>
    <label for="evalDataset">Dataset</label><select id="evalDataset"><option value="golden">Golden</option><option value="holdout">Holdout</option></select>
    <button id="runEvaluation" class="btn btn-primary">Run browser evaluation</button><button id="cancelEvaluation" class="btn btn-outline" disabled>Cancel evaluation</button><p id="evaluationStatus" role="status"></p><button id="exportEvaluation" class="btn btn-outline" hidden>Download evaluation report</button></div>
    <div class="settings-card"><h2>Model readiness</h2><details><summary>Model details</summary><p>${h(MODEL_PROFILE.modelId)} · ${h(MODEL_PROFILE.runtime)} · ${(MODEL_PROFILE.artifactBytes / 1048576).toFixed(1)} MiB published artifacts, plus about 12 MiB optional runtime scripts and transfer overhead. Weights: Hugging Face; compiled library: MLC GitHub. Revisions are pinned in the manifest.</p></details>
    <a class="btn btn-outline" href="#/model">Model download &amp; benchmark controls</a><p>${FEATURES.browserInference ? 'Local pilot only. No device qualified.' : 'Inference off. No downloads.'}</p><button id="probeCapabilities" class="btn btn-outline">Check compatibility</button><p id="capabilityStatus" role="status"></p></div>
    <div class="settings-card"><h2>Feedback</h2><label for="feedbackReason">Reason</label><select id="feedbackReason">${['incorrect_explanation', 'unclear_wording', 'duplicate_item', 'too_slow'].map((s) => `<option>${s}</option>`).join('')}</select><button id="saveFeedback" class="btn btn-outline">Save feedback</button><p id="feedbackStatus" role="status"></p><button id="exportRegression" class="btn btn-outline">Export latest fixture as regression</button></div>`;
  const payload = () => ({ version: 1, events: repo.snapshot().diagnostics, traces: repo.snapshot().traces });
  scope.listen(container.querySelector('#previewDiagnostics'), 'click', () => { const preview = container.querySelector('#diagnosticPreview'); preview.hidden = false; preview.textContent = JSON.stringify(payload(), null, 2); });
  scope.listen(container.querySelector('#exportDiagnostics'), 'click', () => downloadJSON(payload(), 'sharp-diagnostics.json'));
  scope.listen(container.querySelector('#previewSharing'), 'click', () => { const preview = container.querySelector('#sharingPreview'); preview.hidden = false; preview.textContent = JSON.stringify(broker.preview(), null, 2); });
  scope.listen(container.querySelector('#enableSharing'), 'click', async () => {
    try { await broker.setSharing(true, { errors: container.querySelector('#shareErrors').checked }); if (scope.active) container.querySelector('#sharingStatus').textContent = 'Metadata sharing enabled. Only new eligible events can be queued.'; }
    catch (e) { if (scope.active) container.querySelector('#sharingStatus').textContent = e.message; }
  });
  scope.listen(container.querySelector('#disableSharing'), 'click', async () => { await broker.setSharing(false); if (scope.active) container.querySelector('#sharingStatus').textContent = 'Sharing disabled. Pending upload queue purged.'; });
  scope.listen(container.querySelector('#runEvaluation'), 'click', async () => {
    abort = new AbortController(); const scenario = container.querySelector('#evalScenario').value;
    service?.dispose(); service = new IntelligenceService({ repo, broker, provider: new StubProvider({ scenario }) }); await service.prepare();
    container.querySelector('#runEvaluation').disabled = true; container.querySelector('#cancelEvaluation').disabled = false;
    const dataset = container.querySelector('#evalDataset').value === 'golden' ? GOLDEN : HOLDOUT;
    try {
      lastReport = await runEvaluation(service, { dataset, repeats: 3, deadlineMs: scenario === 'timeout' ? 25 : 10000, signal: abort.signal,
        onResult: (r) => { if (scope.active) container.querySelector('#evaluationStatus').textContent = `${r.fixtureId}: ${r.source} · ${r.reason || 'validated'}`; } });
      if (scope.active) { container.querySelector('#evaluationStatus').textContent = `${lastReport.count} runs · ${lastReport.accepted} accepted stub outputs · ${lastReport.fallbackCount} fallbacks · p95 ${lastReport.p95Ms}ms. Model unqualified.`; container.querySelector('#exportEvaluation').hidden = false; }
    } catch (error) { if (scope.active) container.querySelector('#evaluationStatus').textContent = error.message; }
    finally { if (scope.active) { container.querySelector('#runEvaluation').disabled = false; container.querySelector('#cancelEvaluation').disabled = true; } }
  });
  scope.listen(container.querySelector('#cancelEvaluation'), 'click', () => abort?.abort());
  scope.listen(container.querySelector('#exportEvaluation'), 'click', () => downloadJSON(lastReport, 'sharp-evaluation.json'));
  scope.listen(container.querySelector('#probeCapabilities'), 'click', async () => { const report = await probeCapabilities(); if (scope.active) container.querySelector('#capabilityStatus').textContent = `${report.reason}. This probe is advisory; no model was loaded.`; });
  scope.listen(container.querySelector('#saveFeedback'), 'click', async () => { await broker.record('ai.feedback', { code: container.querySelector('#feedbackReason').value }); if (scope.active) container.querySelector('#feedbackStatus').textContent = 'Saved locally.'; });
  scope.listen(container.querySelector('#exportRegression'), 'click', () => { try { const trace = [...repo.snapshot().traces].reverse().find((t) => t.fixtureInput); downloadJSON(regressionFromTrace(trace || {}), 'sharp-regression.json'); } catch (e) { container.querySelector('#feedbackStatus').textContent = e.message; } });
  return scope.dispose;
}
