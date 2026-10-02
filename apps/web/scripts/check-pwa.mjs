import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = resolve(appRoot, 'manifest.webmanifest');
const htmlPath = resolve(appRoot, 'index.html');
const serviceWorkerPath = resolve(appRoot, 'sw.js');

const [manifestText, html, serviceWorker] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(htmlPath, 'utf8'),
  readFile(serviceWorkerPath, 'utf8')
]);

const manifest = JSON.parse(manifestText);
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error('PWA manifest must declare at least one icon.');
}

for (const icon of manifest.icons) {
  if (typeof icon.src !== 'string' || !icon.src.startsWith('./')) {
    throw new Error(`PWA icon must use a relative path: ${icon.src}`);
  }
  await access(resolve(appRoot, icon.src.slice(2)));
}

for (const resource of ['./index.html', './manifest.webmanifest', './styles.css', './icon.svg']) {
  if (!serviceWorker.includes(`'${resource}'`)) {
    throw new Error(`Service Worker does not cache ${resource}.`);
  }
}

for (const reference of ['manifest.webmanifest', 'icon.svg', 'styles.css', 'dist/main.js']) {
  if (!html.includes(`./${reference}`)) {
    throw new Error(`Web App entry does not reference ./${reference}.`);
  }
}

console.log('PWA resource check passed.');
