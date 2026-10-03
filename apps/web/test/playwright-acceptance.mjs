import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as createTcpServer } from 'node:net';
import { chromium } from 'playwright-core';

const repoRoot = resolve(new URL('../../..', import.meta.url).pathname);
const appPath = '/apps/web/';
const title = `Playwright acceptance ${Date.now()}`;
const body = '第一段正文\n第二段正文';

let server;
let context;
let profile;

try {
  profile = await mkdtemp(join(tmpdir(), 'unidock-playwright-'));
  const port = await availablePort();
  server = await startServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/homebrew/bin/chromium'
  });
  let page = await context.newPage();

  await runStorage(page, baseUrl);
  await runWeb(page, baseUrl);
  await context.close();
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/homebrew/bin/chromium'
  });
  page = await context.newPage();
  await runBrowserRestart(page, baseUrl);
  await runStorageRetry(context, baseUrl);
  await runRss(page, baseUrl, server);
  await runBackup(page, baseUrl);
  await runUpdate(page, baseUrl, server, context);
  await runOffline(page, baseUrl, server);

  console.log(JSON.stringify({
    status: 'passed',
    scenarios: [
      'storage',
      'web-content',
      'browser-restart-persistence',
      'rss-import-refresh-remove',
      'backup',
      'pwa-update',
      'pwa-offline'
    ]
  }, null, 2));
} finally {
  if (context) await context.close().catch(() => {});
  if (server) await closeServer(server).catch(() => {});
  if (profile) await rm(profile, { recursive: true, force: true });
}

async function runStorage(page, baseUrl) {
  for (const name of [
    'storage-query-boundary-browser.html',
    'storage-lifecycle-browser.html',
    'storage-errors-browser.html'
  ]) {
    await page.goto(`${baseUrl}/packages/storage/test/${name}`);
    await page.waitForFunction(() =>
      document.querySelector('#result')?.textContent?.includes('result: PASS')
    );
    assert.match(await page.locator('#result').textContent(), /result: PASS/);
  }
}

async function runWeb(page, baseUrl) {
  await page.goto(`${baseUrl}${appPath}`);
  await text(page, '#connection-status', '已连接到本地存储');
  await text(page, '#network-status', '在线');
  await page.locator('#title').fill(title);
  await page.locator('#sourceId').fill('playwright');
  await page.locator('#tags').fill('browser,acceptance');
  await page.locator('#body').fill(body);
  await page.getByRole('button', { name: '保存到本地' }).click();
  await text(page, '#content-list', title);
  await openContent(page);
  await page.locator('#toggle-read').click();
  await text(page, '#reader-state', '已读');
  await page.locator('#toggle-starred').click();
  await text(page, '#reader-state', '已收藏');
  await page.locator('#back-to-list').click();
  await text(page, '#content-list', '已读');
  await text(page, '#content-list', '已收藏');
  await page.locator('#content-status-filter').selectOption('starred');
  await text(page, '#content-list', title);
  await page.locator('#content-search').fill('does-not-match');
  await page.waitForFunction(() =>
    document.querySelector('#content-list')?.textContent === ''
  );
  await page.locator('#content-search').fill(title);
  await page.reload();
  await text(page, '#content-list', title);
  await openContent(page);
  await text(page, '#reader-state', '已读');
  await text(page, '#reader-state', '已收藏');
}

async function runBrowserRestart(page, baseUrl) {
  await page.goto(`${baseUrl}${appPath}`);
  await text(page, '#connection-status', '已连接到本地存储');
  await text(page, '#content-list', title);
  await openContent(page);
  await text(page, '#reader-state', '已读');
  await text(page, '#reader-state', '已收藏');
}

async function runStorageRetry(browserContext, baseUrl) {
  const retryPage = await browserContext.newPage();
  await retryPage.addInitScript(() => {
    const indexedDBFactory = globalThis.indexedDB;
    const originalOpen = indexedDBFactory.open.bind(indexedDBFactory);
    let failFirstOpen = true;
    Object.defineProperty(indexedDBFactory, 'open', {
      configurable: true,
      value(...args) {
        if (failFirstOpen) {
          failFirstOpen = false;
          throw new DOMException('Injected storage open failure', 'InvalidStateError');
        }
        return originalOpen(...args);
      }
    });
  });
  await retryPage.goto(`${baseUrl}${appPath}`);
  await text(retryPage, '#connection-status', '连接失败');
  await text(retryPage, '#list-error', '本地存储连接已关闭');
  await retryPage.getByRole('button', { name: '重试连接' }).click();
  await text(retryPage, '#connection-status', '已连接到本地存储');
  await assert.equal(await retryPage.locator('#storage-retry').isHidden(), true);
  await retryPage.close();
}

async function runBackup(page, baseUrl) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const backupPath = await download.path();
  assert.ok(backupPath, 'Backup download did not produce a file.');
  const item = page.locator('#content-list li').filter({ hasText: title });
  const contentId = await item.locator('button[data-action="delete"]')
    .getAttribute('data-content-id');
  assert.ok(contentId, 'Saved content did not expose an id.');
  await item.getByRole('button', { name: '删除' }).click();
  await page.waitForFunction((value) =>
    !document.querySelector('#content-list')?.textContent?.includes(value), title);
  const relatedRecords = await page.evaluate(async (id) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('unidock');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction('records', 'readonly')
        .objectStore('records').index('by-collection').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return records.filter((record) =>
      (record.collection === 'contents' && record.id === id) ||
      (record.collection === 'reader-documents' && record.id === `document:${id}`) ||
      (record.collection === 'reader-state' && record.id === id)
    ).length;
  }, contentId);
  assert.equal(relatedRecords, 0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#import-file').setInputFiles(backupPath);
  await text(page, '#backup-status', '已恢复');
  await text(page, '#content-list', title);
  await openContent(page);
  await text(page, '#reader-state', '已读');
  await text(page, '#reader-state', '已收藏');
}

async function runRss(page, baseUrl, staticServer) {
  await page.locator('#back-to-list').click();
  const feedUrl = `${baseUrl}/acceptance/feed.xml`;
  await page.locator('#feed-url').fill(feedUrl);
  await page.getByRole('button', { name: '导入 Feed' }).click();
  await text(page, '#feed-import-status', '已导入 1 篇：UniDock Journal（新增 1，更新 0，未变化 0）');
  await text(page, '#feed-list', 'UniDock Journal');
  await text(page, '#content-list', 'First article');

  const feedItem = page.locator('#feed-list li').filter({ hasText: 'UniDock Journal' });
  staticServer.failNextFeedRequest();
  await feedItem.getByRole('button', { name: '刷新' }).click();
  await text(page, '#feed-import-status', '重新抓取失败');
  await text(page, '#feed-list', 'UniDock Journal');
  await text(page, '#feed-list', '最近失败');
  await page.getByRole('button', { name: '重试' }).click();
  await text(page, '#feed-import-status', '已重新抓取 1 篇：UniDock Journal（新增 0，更新 0，未变化 1）');
  await text(page, '#feed-list', '最近成功');
  await feedItem.getByRole('button', { name: '移除' }).click();
  await text(page, '#feed-import-status', '已移除 Feed 订阅');
  await page.waitForFunction(() =>
    !document.querySelector('#feed-list')?.textContent?.includes('UniDock Journal')
  );
  await text(page, '#content-list', 'First article');
}

async function runUpdate(page, baseUrl, staticServer, browserContext) {
  const otherPage = await browserContext.newPage();
  await otherPage.goto(`${baseUrl}${appPath}`);
  await text(otherPage, '#connection-status', '已连接到本地存储');
  staticServer.setServiceWorkerVersion(5);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await page.waitForFunction(async () =>
    Boolean((await navigator.serviceWorker.getRegistration())?.waiting)
  );
  await text(page, '#app-update-status', '发现新版本');
  await page.getByRole('button', { name: '立即更新' }).click();
  await text(page, '#content-list', title);
  await openContent(page);
  await text(page, '#reader-state', '已读');
  await text(page, '#reader-state', '已收藏');
  await text(otherPage, '#app-update-status', '请刷新页面');
  await otherPage.getByRole('button', { name: '刷新页面' }).click();
  await text(otherPage, '#content-list', title);
  await otherPage.close();
}

async function runOffline(page, baseUrl, staticServer) {
  await page.context().setOffline(true);
  await closeServer(staticServer);
  await page.close();
  const coldPage = await page.context().newPage();
  await coldPage.goto(`${baseUrl}${appPath}`);
  await text(coldPage, '#network-status', '离线模式');
  await text(coldPage, '#content-list', title);
  assert.equal(await coldPage.locator('#feed-url').isDisabled(), true);
  assert.equal(await coldPage.locator('#feed-submit').isDisabled(), true);
  assert.equal(await coldPage.locator('#feed-refresh').isDisabled(), true);
  await coldPage.close();
  await page.context().setOffline(false);
}

async function openContent(page) {
  await page.locator('#content-list li').filter({ hasText: title })
    .getByRole('button', { name: '打开' }).click();
  await text(page, '#reader-title', title);
}

async function text(page, selector, expected) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForFunction(({ selector: current, expected: value }) =>
    document.querySelector(current)?.textContent?.includes(value),
  { selector, expected });
}

async function availablePort() {
  const probe = createTcpServer();
  await new Promise((resolvePromise, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : undefined;
  await new Promise((resolvePromise, reject) => {
    probe.close((error) => error ? reject(error) : resolvePromise());
  });
  if (!port) throw new Error('Unable to allocate a port.');
  return port;
}

async function startServer(port) {
  let serviceWorkerVersion = 4;
  let failNextFeed = false;
  const feedFixture = await readFile(
    resolve(repoRoot, 'plugins/rss/test/fixtures/rss.xml')
  );
  const httpServer = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(
        request.url ?? '/',
        `http://${request.headers.host}`
      ).pathname);
      if (requestPath === '/acceptance/feed.xml') {
        if (failNextFeed) {
          failNextFeed = false;
          response.writeHead(503, { 'Cache-Control': 'no-store' });
          response.end('Injected feed failure');
          return;
        }
        response.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        response.end(feedFixture);
        return;
      }
      const relativePath = requestPath.endsWith('/')
        ? `${requestPath}index.html`
        : requestPath;
      const filePath = resolve(repoRoot, `.${normalize(relativePath)}`);
      if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      let content = await readFile(filePath);
      if (requestPath === '/apps/web/sw.js') {
        content = Buffer.from(content.toString().replace(
          /unidock-web-v\d+/g,
          `unidock-web-v${serviceWorkerVersion}`
        ));
      }
      const types = {
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json; charset=utf-8'
      };
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': types[extname(filePath)] ?? 'application/octet-stream'
      });
      response.end(content);
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      response.writeHead(status);
      response.end(status === 404 ? 'Not found' : 'Internal server error');
    }
  });
  await new Promise((resolvePromise, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', resolvePromise);
  });
  httpServer.setServiceWorkerVersion = (version) => {
    serviceWorkerVersion = version;
  };
  httpServer.failNextFeedRequest = () => {
    failNextFeed = true;
  };
  return httpServer;
}

async function closeServer(httpServer) {
  if (!httpServer.listening) return;
  await new Promise((resolvePromise, reject) => {
    httpServer.close((error) => error ? reject(error) : resolvePromise());
  });
}
