import { build } from 'esbuild';

await build({
  bundle: true,
  entryPoints: ['src/browser.ts'],
  format: 'esm',
  outfile: 'dist/browser.js',
  platform: 'browser',
  sourcemap: true,
  target: 'es2022'
});
