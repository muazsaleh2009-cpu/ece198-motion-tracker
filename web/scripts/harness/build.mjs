// Verification build only (the real build is `vite build`): bundles the app with esbuild and
// swaps lucide-react for a tiny stub, since there is no network here to install the real package.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const esbuild = require('/opt/npm-tools/node_modules/esbuild');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const nm = '/opt/npm-tools/node_modules';
const out = path.join(root, 'dist-check');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'main.jsx')], bundle: true, outfile: path.join(out, 'app.js'), format: 'iife',
  jsx: 'automatic', loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"development"' },
  alias: { 'lucide-react': path.join(root, 'scripts', 'harness', 'lucide-stub.jsx'), react: path.join(nm, 'react'), 'react-dom': path.join(nm, 'react-dom') },
  logLevel: 'info',
});
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kinesis Care</title></head><body style="margin:0"><div id="root"></div><script src="app.js"></script></body></html>');
console.log('built', out);
