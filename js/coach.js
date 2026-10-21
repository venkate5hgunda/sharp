import { createCoachPacer } from './core/coach-responses.js';
import { probeCapabilities } from './core/capabilities.js';
import { coachContext } from './core/engagement.js';
import { FEATURES } from './core/feature-flags.js';
import { MODEL_PROFILE } from './intelligence/model-manifest.js';
import { runCoachTask } from './intelligence/coach-contract.js';
export { COACH_PROMPT, validQuote } from './intelligence/coach-contract.js';
export function mountCoach(repo) {
  const host = document.createElement('aside'); host.className = 'pip-coach'; host.setAttribute('aria-label', 'Pip practice coach');
  host.innerHTML = `<div class="pip-panel" id="pipPanel" hidden><div class="pip-heading"><strong>Pip</strong><button class="icon-btn" id="pipClose" aria-label="Close coach">×</button></div><p id="pipQuote" role="status"></p><small id="pipSource" hidden>Curated encouragement · on this device</small><div class="pip-actions"><button class="btn btn-outline" id="pipNext">A little encouragement</button></div><details ${FEATURES.browserInference ? '' : 'hidden'}><summary>On-device AI coach</summary><p>Optional experimental model. Downloads about ${Math.ceil(MODEL_PROFILE.artifactBytes / 1048576)} MiB plus runtime. Requires WebGPU. Training works without it.</p><button id="pipEnable" class="btn btn-outline" ${FEATURES.browserInference ? '' : 'disabled'}>Download &amp; enable AI</button><button id="pipStop" class="btn btn-outline">Stop AI</button><p id="pipModelStatus" role="status">${FEATURES.browserInference ? 'No model downloaded automatically. Without a supported GPU, Pip uses offline contextual responses.' : 'AI release gate is off. Offline contextual responses are available. Automatic updates are spaced at least 90 seconds apart.'}</p></details></div><button class="pip-launch" aria-expanded="false" aria-controls="pipPanel" aria-label="Talk to Pip, your practice coach"><span class="pip-body" aria-hidden="true"><span class="pip-eyes">••</span><span class="pip-smile">⌣</span></span><span>Pip <span aria-hidden="true">✦</span></span></button>`;
  document.body.append(host); const pacer = createCoachPacer(), recentModelQuotes = []; let provider, abort, busy = false, revision = 0;
  const panel = host.querySelector('#pipPanel'), launch = host.querySelector('.pip-launch'), quote = host.querySelector('#pipQuote'), source = host.querySelector('#pipSource'), status = host.querySelector('#pipModelStatus');
  async function refresh({ force = false } = {}) {
    const context = coachContext(repo.snapshot(), location.hash.replace('#/', ''));
    const fallbackQuote = pacer.next(context, { force }); if (!fallbackQuote) return;
    const current = ++revision;
    quote.textContent = fallbackQuote; source.textContent = 'Curated encouragement · on this device';
    if (!provider || provider.getStatus().state !== 'ready' || busy) return;
    busy = true; const controller = new AbortController(); abort = controller;
    try { const result = await runCoachTask(provider, context, { requestId: `coach-${current}`, signal: controller.signal }); if (current === revision) { const freshModel = result.source === 'model' && !recentModelQuotes.includes(result.output.quote);
      if (freshModel) { recentModelQuotes.push(result.output.quote); if (recentModelQuotes.length > 8) recentModelQuotes.shift(); }
      quote.textContent = freshModel ? result.output.quote : fallbackQuote; source.textContent = freshModel ? 'AI-selected reviewed encouragement · on this device' : 'Curated encouragement · AI unavailable'; } } finally { busy = false; }
  }
  function open(value) { panel.hidden = !value; launch.setAttribute('aria-expanded', String(value)); if (value) { refresh(); host.querySelector('#pipClose').focus(); } else { ++revision; abort?.abort(); launch.focus(); } }
  launch.onclick = () => open(panel.hidden); host.querySelector('#pipClose').onclick = () => open(false);
  host.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) open(false); }); host.querySelector('#pipNext').onclick = () => refresh({ force: true });
  host.querySelector('#pipEnable').onclick = async () => {
    if (!FEATURES.browserInference || busy) return; busy = true; abort = new AbortController();
    const button = host.querySelector('#pipEnable'); button.disabled = true;
    try { const capability = await probeCapabilities(); if (!capability.eligible) { status.textContent = 'This device uses Pip’s offline contextual responses. No model download needed.'; return; } const { WebLLMProvider } = await import('./intelligence/webllm-provider.js'); provider ||= new WebLLMProvider(); await provider.prepare(MODEL_PROFILE, { consent: true, allowUnqualified: false, signal: abort.signal, onProgress: p => { status.textContent = p.text || p.phase; } }); status.textContent = 'AI ready. Quotes stay on this device.'; } catch (e) { status.textContent = `AI unavailable: ${e.message}. Pip still has encouragement.`; } finally { busy = false; button.disabled = !FEATURES.browserInference; refresh(); }
  };
  host.querySelector('#pipStop').onclick = () => { ++revision; abort?.abort(); provider?.dispose(); status.textContent = 'AI stopped. Cached model files can be removed in Model benchmark.'; };
  window.addEventListener('sharp:coach-context', () => { if (!panel.hidden) refresh(); });
  window.addEventListener('hashchange', () => { ++revision; abort?.abort(); if (!panel.hidden) refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { ++revision; abort?.abort(); provider?.dispose(); } });
}
