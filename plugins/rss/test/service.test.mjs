import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FeedFetcher, FeedImportService } from '../dist/index.js';

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

function createService(contentRepository = new MemoryContentRepository()) {
  const documentRepository = new MemoryDocumentRepository();
  const fetcher = new FeedFetcher({
    fetch: async () => new Response(rss, {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' }
    })
  });
  return {
    service: new FeedImportService(contentRepository, documentRepository, fetcher),
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
  assert.equal((await contentRepository.list()).length, 1);
  assert.equal((await documentRepository.getByContentId('feed:rss::article-first'))?.blocks.length, 1);
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

