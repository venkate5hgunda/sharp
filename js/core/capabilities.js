const bounded = (promise, code) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(code)), 3000); })]).finally(() => clearTimeout(timer));
};
async function probeStorage(factory) {
  if (!factory) throw new Error('storage_unavailable');
  const name = `sharp-capability-${crypto.randomUUID()}`; let db, expired = false;
  try {
    await bounded(new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('probe');
      request.onerror = () => reject(new Error('storage_unavailable'));
      request.onsuccess = () => {
        db = request.result;
        if (expired) { db.close(); factory.deleteDatabase(name); return; }
        const tx = db.transaction('probe', 'readwrite'); tx.objectStore('probe').put('ok', 'ping');
        tx.oncomplete = resolve; tx.onabort = () => reject(new Error('storage_unavailable'));
      };
    }), 'storage_unavailable');
  } finally { expired = true; db?.close(); factory.deleteDatabase(name); }
}
export async function probeCapabilities({ gpu = globalThis.navigator?.gpu, factory = globalThis.indexedDB, workerFactory, secure = globalThis.isSecureContext } = {}) {
  const report = { version: 1, secure: !!secure, indexedDB: false, worker: false, webgpu: false, shaderF16: false, bufferLimits: false, eligible: false, reason: null };
  let worker, device, finished = false;
  try {
    if (!report.secure) throw new Error('insecure_context');
    await probeStorage(factory); report.indexedDB = true;
    worker = workerFactory ? workerFactory() : new Worker(new URL('../intelligence/probe-worker.js', import.meta.url), { type: 'module' });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('worker_timeout')), 3000);
      worker.onmessage = () => { clearTimeout(timer); resolve(); }; worker.onerror = () => { clearTimeout(timer); reject(new Error('worker_failed')); }; worker.postMessage('probe'); });
    report.worker = true;
    if (!gpu) throw new Error('webgpu_unavailable');
    const adapter = await bounded(gpu.requestAdapter(), 'adapter_unavailable'); if (!adapter) throw new Error('adapter_unavailable');
    report.webgpu = true; report.shaderF16 = adapter.features.has('shader-f16');
    if (!report.shaderF16) throw new Error('shader_f16_unavailable');
    report.bufferLimits = adapter.limits.maxStorageBufferBindingSize >= 128 * 1048576 && adapter.limits.maxBufferSize >= 256 * 1048576;
    if (!report.bufferLimits) throw new Error('buffer_limits_insufficient');
    device = await bounded(adapter.requestDevice({ requiredFeatures: ['shader-f16'] }).then((value) => { if (finished) value.destroy(); return value; }), 'device_allocation_failed');
    report.eligible = true; report.reason = 'advisory_probe_passed';
  } catch (e) { report.reason = ['storage_unavailable', 'insecure_context', 'worker_timeout', 'worker_failed', 'webgpu_unavailable', 'adapter_unavailable', 'shader_f16_unavailable', 'buffer_limits_insufficient'].includes(e.message) ? e.message : 'device_allocation_failed'; }
  finally { finished = true; worker?.terminate(); device?.destroy(); }
  return report;
}
