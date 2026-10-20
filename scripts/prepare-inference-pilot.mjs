import { cp, mkdtemp, readFile, writeFile, realpath, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationInputs } from './evaluation-inputs.mjs';
import { generateManifest } from './build-offline-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareInferencePilot() {
  const destination = await mkdtemp(path.join(tmpdir(), 'sharp-inference-pilot-'));
  for (const name of ['js', 'data', 'css', 'assets', 'index.html', 'manifest.json', 'sw.js']) {
    await cp(path.join(root, name), path.join(destination, name), { recursive: true });
  }
  const inputs = await evaluationInputs(root);
  for (const name of inputs.files) {
    await mkdir(path.dirname(path.join(destination, name)), { recursive: true });
    await cp(path.join(root, name), path.join(destination, name));
  }
  await writeFile(path.join(destination, 'evaluation-inputs.json'), JSON.stringify(inputs, null, 2) + '\n');
  const flagsPath = path.join(destination, 'js/core/feature-flags.js');
  const flags = await readFile(flagsPath, 'utf8');
  if (!flags.includes('browserInference: false')) throw new Error('Expected disabled release inference flag.');
  await writeFile(flagsPath, flags.replace('browserInference: false', 'browserInference: true'));
  const manifest = await generateManifest(destination);
  await writeFile(path.join(destination, 'offline-manifest.js'), manifest);
  const shellVersion = JSON.parse(manifest.slice(manifest.indexOf('{'), -2)).version;
  await writeFile(path.join(destination, 'pilot-build.json'), JSON.stringify({
    version: 1, shellVersion, createdAt: new Date().toISOString(),
    inferenceEnabled: true, remoteSharingEnabled: false, qualified: false
  }, null, 2) + '\n');
  return { destination, shellVersion };
}
if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pilot = await prepareInferencePilot();
  console.log(`Isolated pilot: ${pilot.destination}\nShell: ${pilot.shellVersion}\nServe this directory on localhost, then open /#/model. Download requires an explicit choice.\nRelease flags and remote sharing are unchanged.`);
}
