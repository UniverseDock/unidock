import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FeedFetcher, FeedImportService, htmlToBlocks } from '../dist/index.js';

const rss = await readFile(new URL('./fixtures/rss.xml', import.meta.url), 'utf8');

class MemoryContentRepository {
  constructor() {
    this.values = new Map();
  }

  async get(id) {
    return this.values.get(id);
  }

  async save(content) {
    this.values.set(content.id, { ...content });
  }

  async delete(id) {
    this.values.delete(id);
  }

  async list() {
    return [...this.values.values()];
  }
}

class MemoryDocumentRepository {
  constructor() {
    this.values = new Map();
  }

  async get(id) {
    return this.values.get(id);
  }

  async getByContentId(contentId) {
    return [...this.values.values()].find((document) => document.contentId === contentId);
  }

  async save(document) {
    this.values.set(document.id, structuredClone(document));
  }

  async delete(id) {
    this.values.delete(id);
  }
}

function createService(contentRepository = new MemoryContentRepository(), fetchImpl) {
  const documentRepository = new MemoryDocumentRepository();
  const fetcher = new FeedFetcher({
    fetch: fetchImpl ?? (async () => new Response(rss, {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' }
    }))
  });
  return {
    service: new FeedImportService(contentRepository, documentRepository, fetcher, (html, url) => ({
      blocks: htmlToBlocks(html, url)
    })),
    contentRepository,
    documentRepository
  };
}

test('imports fetched RSS items into Content and Reader documents', async () => {
  const { service, contentRepository, documentRepository } = createService();
  const result = await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:rss'
  });

  assert.equal(result.feed.title, 'UniDock Journal');
  assert.equal(result.contents.length, 1);
  assert.equal(result.documents.length, 1);
  assert.deepEqual(
    { added: result.added, updated: result.updated, unchanged: result.unchanged },
    { added: 1, updated: 0, unchanged: 0 }
  );
  assert.equal((await contentRepository.list()).length, 1);
  assert.equal((await documentRepository.getByContentId('feed:rss::article-first'))?.blocks.length, 1);
});

test('fetches and extracts an article when the feed only contains a summary', async () => {
  const summaryFeed = `
    <rss version="2.0">
      <channel>
        <title>Summary Feed</title>
        <item>
          <title>Article page</title>
          <link>https://example.com/articles/1</link>
          <guid>summary-article</guid>
          <description><![CDATA[<p>Short summary...</p>]]></description>
        </item>
      </channel>
    </rss>
  `;
  const articleHtml = `
    <html>
      <body>
        <article>
          <h1>Article page</h1>
          <p>Full article paragraph one.</p>
          <p>Full article paragraph two.</p>
        </article>
      </body>
    </html>
  `;
  const requests = [];
  const { service, documentRepository } = createService(
    new MemoryContentRepository(),
    async (url, init) => {
      requests.push({ url, accept: init.headers.accept });
      const isFeed = new URL(url).pathname.endsWith('/feed.xml');
      return new Response(isFeed ? summaryFeed : articleHtml, {
        status: 200,
        headers: { 'content-type': isFeed ? 'application/rss+xml' : 'text/html' }
      });
    }
  );

  const result = await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:summary'
  });
  const second = await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:summary'
  });
  const document = await documentRepository.getByContentId(result.contents[0].id);

  assert.equal(requests.length, 4);
  assert.deepEqual(
    { added: second.added, updated: second.updated, unchanged: second.unchanged },
    { added: 0, updated: 0, unchanged: 1 }
  );
  assert.match(requests[0].accept, /application\/rss\+xml/);
  assert.match(requests[1].accept, /text\/html/);
  assert.deepEqual(document.blocks.map(({ type, text }) => ({ type, text })), [
    { type: 'heading', text: 'Article page' },
    { type: 'paragraph', text: 'Full article paragraph one.' },
    { type: 'paragraph', text: 'Full article paragraph two.' }
  ]);
});

test('keeps the summary document when article extraction fails', async () => {
  const summaryFeed = `
    <rss version="2.0">
      <channel>
        <title>Summary Feed</title>
        <item>
          <title>Unavailable article</title>
          <link>https://example.com/articles/missing</link>
          <guid>missing-article</guid>
          <description><![CDATA[<p>Useful summary.</p>]]></description>
        </item>
      </channel>
    </rss>
  `;
  const { service, documentRepository } = createService(
    new MemoryContentRepository(),
    async (url) => {
      if (new URL(url).pathname.endsWith('/feed.xml')) return new Response(summaryFeed);
      throw new Error('article unavailable');
    }
  );

  const result = await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:summary'
  });
  const document = await documentRepository.getByContentId(result.contents[0].id);

  assert.deepEqual(document.blocks.map(({ type, text }) => ({ type, text })), [
    { type: 'paragraph', text: 'Useful summary.' }
  ]);
});

test('re-imports the same item without duplicating Content or Document', async () => {
  const { service, contentRepository, documentRepository } = createService();
  await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:rss'
  });
  await service.importFromUrl({
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:rss'
  });

  assert.equal((await contentRepository.list()).length, 1);
  assert.equal(documentRepository.values.size, 1);
});
