// Bundle the Node tests with esbuild (JSON imports included) and run them.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = require('/opt/npm-tools/node_modules/esbuild'); }

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let status = 0;
for (const name of ['analytics', 'features']) {
  const out = path.join(root, 'tests', `.bundle-${name}.mjs`);
  await esbuild.build({ entryPoints: [path.join(root, 'tests', `${name}.test.mjs`)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
  const r = spawnSync('node', [out], { stdio: 'inherit' });
  status = status || (r.status ?? 1);
}
process.exit(status);
