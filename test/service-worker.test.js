import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { generateManifest } from '../scripts/build-offline-manifest.mjs';

const scope = 'https://example.com/sharp/';
const script = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const manifestSource = await generateManifest();
const manifestContext = { self: {} };
vm.runInNewContext(manifestSource, manifestContext);
const manifest = manifestContext.self.SHARP_OFFLINE;

function worker() {
  const handlers = {};
  const stores = new Map();
  const deleted = [];
  const requests = [];
  const notifications = [];
  const self = { registration: { scope, showNotification: async (title, options) => { notifications.push({ title, options }); } }, addEventListener: (name, callback) => { handlers[name] = callback; } };
  vm.runInNewContext(script, {
    self, URL, Request,
    importScripts() { self.SHARP_OFFLINE = manifest; },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (key) => { deleted.push(key); return stores.delete(key); },
      open: async (key) => {
        if (!stores.has(key)) stores.set(key, new Map());
        const store = stores.get(key);
        return {
          addAll: async (items) => { for (const item of items) store.set(item.url, item.url); },
          match: async (key) => store.get(key)
        };
      }
    },
    fetch: async (request) => { requests.push(request.url); return 'network'; }
  });
  async function lifecycle(name) {
    let pending;
    handlers[name]({ waitUntil(value) { pending = value; } });
    await pending;
  }
  return { handlers, stores, deleted, requests, lifecycle, notifications };
}

test('offline snapshot includes the full app and dataset dependency graph', async () => {
  assert.equal(await readFile(new URL('../offline-manifest.js', import.meta.url), 'utf8'), manifestSource);
  for (const asset of manifest.assets.filter((name) => name.endsWith('.js'))) {
    const contents = await readFile(new URL('../' + asset, import.meta.url), 'utf8');
    for (const match of contents.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const dependency = new URL(match[1], scope + asset).href.slice(scope.length);
      assert.ok(manifest.assets.includes(dependency), `${asset} needs ${dependency}`);
    }
  }
  assert.ok(manifest.assets.includes('data/domains/memory-clusters.js'));
  assert.equal(manifest.assets.some((name) => name.startsWith('assets/optional-runtime/')), false, 'Optional model runtime must never enter shell precaching');
  assert.equal(manifest.assets.some((name) => name.split('/').some((part) => part.startsWith('.'))), false,
    'Local metadata such as .DS_Store must never become a deployment dependency');
});

test('activation preserves model, sibling-app and other-scope caches', async () => {
  const w = worker();
  const unrelated = ['webllm/model-cache', 'another-app', 'sharp:models:v1', 'sharp:shell:https://example.com/other/:old'];
  for (const name of [...unrelated, `sharp:shell:${scope}:old`, 'sharp:static:v1']) w.stores.set(name, new Map());
  await w.lifecycle('install');
  await w.lifecycle('activate');
  for (const name of unrelated) assert.ok(w.stores.has(name), name);
  assert.deepEqual(w.deleted.sort(), [`sharp:shell:${scope}:old`, 'sharp:static:v1'].sort());
});

test('offline fetch serves one installed snapshot without background revalidation', async () => {
  const w = worker();
  await w.lifecycle('install');
  for (const name of ['index.html', 'js/router.js', 'data/questions-db.js', 'data/domains/logic-puzzles.js']) {
    let response;
    w.handlers.fetch({ request: new Request(scope + name), respondWith(value) { response = value; } });
    assert.equal(await response, scope + name);
  }
  assert.deepEqual(w.requests, []);
  let intercepted = false;
  w.handlers.fetch({ request: new Request('https://models.example/weights'), respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
});

test('push chooses safe local recall destinations and handles malformed payloads', async () => {
  const w = worker();
  for (const data of [{ json: () => ({ kind: 'recall', url: 'https://untrusted.example', body: '<script>bad</script>' }) }, { json: () => { throw new Error('malformed'); } }]) {
    let pending; w.handlers.push({ data, waitUntil(value) { pending = value; } }); await pending;
  }
  assert.equal(w.notifications[0].options.data.url, 'index.html#/games/delayed-memory');
  assert.equal(w.notifications[1].options.data.url, 'index.html#/today');
  assert.ok(w.notifications.every(n => !n.options.body.includes('<script>') && n.options.tag === 'sharp-daily'));
});
