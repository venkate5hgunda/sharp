// Deploy the service as one Worker module; author and test its responsibilities separately.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await build({
  entryPoints: [fileURLToPath(new URL('server/push/worker.js', root))],
  outfile: fileURLToPath(new URL('.cache/sharp-push/worker.js', root)),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
});
console.log('Push service built: .cache/sharp-push/worker.js');
