import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fingerprintInputs } from '../js/intelligence/evaluation-quality.js';

export async function evaluationInputs(root) {
  const { metafile } = await build({ absWorkingDir: root, entryPoints: ['js/views/model-view.js', 'js/coach.js'], bundle: true, write: false, outdir: 'unused-evaluation-output', metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent' });
  const files = [...new Set([...Object.keys(metafile.inputs),
    ...(await readdir(path.join(root, 'js/intelligence'))).filter((name) => name.endsWith('.js')).map((name) => `js/intelligence/${name}`),
    ...(await readdir(path.join(root, 'assets/optional-runtime'))).map((name) => `assets/optional-runtime/${name}`),
    'package.json', 'package-lock.json', 'scripts/inference-client-entry.js', 'scripts/inference-worker-entry.js',
    'scripts/record-model-eval.mjs', 'scripts/check-staged-evals.mjs', 'scripts/run-model-evals.mjs', 'scripts/prepare-inference-pilot.mjs', 'scripts/build-inference.mjs', 'scripts/evaluation-inputs.mjs', 'scripts/check-evals.mjs'
  ])].sort();
  if (files.some((name) => name.startsWith('../') || path.isAbsolute(name))) throw new Error('Evaluation dependency outside repository.');
  return { version: 1, files, fingerprint: await fingerprintInputs(files, (name) => readFile(path.join(root, name))) };
}
export function needsFullEvaluation(files) {
  return files.some((name) => /^(js\/intelligence\/|js\/core\/|js\/persistence\/|js\/views\/model-view\.js$|js\/coach\.js$|js\/content-validation\.js$|assets\/optional-runtime\/|scripts\/.*(?:eval|inference)|test\/.*(?:intelligence|webllm|eval|inference)|\.githooks\/|package(?:-lock)?\.json$)/.test(name));
}
