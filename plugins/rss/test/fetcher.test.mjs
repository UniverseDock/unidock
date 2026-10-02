import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FeedEmptyResponseError,
  FeedFetchAbortedError,
  FeedFetcher,
  FeedFetchTimeoutError,
  FeedHttpError,
  FeedResponseTooLargeError
} from '../dist/index.js';

function response(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml' },
    ...init
  });
}

test('fetches XML with an RSS Accept header', async () => {
  let request;
  const fetcher = new FeedFetcher({
    fetch: async (input, init) => {
      request = { input, init };
      return response('<rss />');
    }
  });

  assert.equal(await fetcher.fetchXml('https://example.org/feed.xml'), '<rss />');
  assert.equal(request.input, 'https://example.org/feed.xml');
  assert.match(request.init.headers.accept, /application\/rss\+xml/);
});

test('fetches article HTML with an HTML Accept header', async () => {
  let request;
  const fetcher = new FeedFetcher({
    fetch: async (input, init) => {
      request = { input, init };
      return response('<html><body>Article</body></html>', {
        headers: { 'content-type': 'text/html' }
      });
    }
  });

  assert.equal(
    await fetcher.fetchHtml('https://example.org/articles/1'),
    '<html><body>Article</body></html>'
  );
  assert.equal(request.input, 'https://example.org/articles/1');
  assert.match(request.init.headers.accept, /text\/html/);
});

test('uses the browser fetch with its global receiver', async () => {
  const originalFetch = globalThis.fetch;
  const receiver = globalThis;
  globalThis.fetch = function (input, init) {
    assert.equal(this, receiver);
    return Promise.resolve(response('<rss />'));
  };
  try {
    assert.equal(await new FeedFetcher().fetchXml('https://example.org/feed.xml'), '<rss />');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects invalid URLs, HTTP errors, empty responses and oversized responses', async () => {
  await assert.rejects(
    () => new FeedFetcher({ fetch: async () => response('ok') }).fetchXml('ftp://example.org/feed.xml'),
    /must use http or https/
  );
  await assert.rejects(
    () => new FeedFetcher({ fetch: async () => response('no', { status: 503, statusText: 'Unavailable' }) }).fetchXml('https://example.org/feed.xml'),
    FeedHttpError
  );
  await assert.rejects(
    () => new FeedFetcher({ fetch: async () => response('   ') }).fetchXml('https://example.org/feed.xml'),
    FeedEmptyResponseError
  );
  await assert.rejects(
    () => new FeedFetcher({ maxResponseBytes: 2, fetch: async () => response('123') }).fetchXml('https://example.org/feed.xml'),
    FeedResponseTooLargeError
  );
});

test('times out a slow request and forwards caller cancellation', async () => {
  await assert.rejects(
    () => new FeedFetcher({
      timeoutMs: 5,
      fetch: (_url, init) => new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    }).fetchXml('https://example.org/feed.xml'),
    FeedFetchTimeoutError
  );

  const controller = new AbortController();
  const promise = new FeedFetcher({
    fetch: (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })
  }).fetchXml('https://example.org/feed.xml', { signal: controller.signal });
  controller.abort();
  await assert.rejects(promise, FeedFetchAbortedError);
});
