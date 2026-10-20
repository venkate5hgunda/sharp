import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { prepareInferencePilot } from '../scripts/prepare-inference-pilot.mjs';
import { generateManifest } from '../scripts/build-offline-manifest.mjs';
import { FEATURES } from '../js/core/feature-flags.js';

test('pilot is isolated, has a complete shell, and enables only local inference', async () => {
  const { destination, shellVersion } = await prepareInferencePilot();
  try {
    const flags = await readFile(path.join(destination, 'js/core/feature-flags.js'), 'utf8');
    assert.match(flags, /browserInference: true/);
    for (const flag of ['remoteDeveloperTelemetry', 'remotePromptPayloads', 'remoteAppDiagnostics', 'experimentalGeneratedScoredItems']) assert.match(flags, new RegExp(`${flag}: false`));
    assert.equal(FEATURES.browserInference, false);
    const manifest = await readFile(path.join(destination, 'offline-manifest.js'), 'utf8');
    assert.equal(manifest, await generateManifest(destination)); assert.ok(manifest.includes(shellVersion));
    assert.ok(!manifest.includes('optional-runtime'));
    await access(path.join(destination, 'assets/optional-runtime/webllm-0.2.86-client.js'));
    for (const name of ['.git', '.env', 'node_modules', 'docs', 'test']) await assert.rejects(access(path.join(destination, name)));
    assert.equal(JSON.parse(await readFile(path.join(destination, 'pilot-build.json'), 'utf8')).qualified, false);
  } finally { await rm(destination, { recursive: true, force: true }); }
});
