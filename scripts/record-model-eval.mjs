import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluationInputs } from './evaluation-inputs.mjs';
import { checkModelReport } from '../js/intelligence/evaluation-quality.js';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const name = process.argv[2];
  if (!name || (await stat(name)).size > 1024 * 1024) throw new Error('Provide a browser report smaller than 1 MiB.');
  const report = JSON.parse(await readFile(name, 'utf8'));
  checkModelReport(report, await evaluationInputs(root));
  await writeFile(new URL('../evals/model-baseline.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log('Recorded passing model evidence. Stage evals/model-baseline.json with the source changes.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
