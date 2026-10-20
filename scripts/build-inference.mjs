import { build } from 'esbuild';
for (const name of ['client', 'worker']) await build({ entryPoints: [`scripts/inference-${name}-entry.js`], bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline',
  outfile: `assets/optional-runtime/webllm-0.2.86-${name}.js` });
