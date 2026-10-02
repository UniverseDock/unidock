import assert from 'node:assert/strict';
import test from 'node:test';

import { feedItemToArticle, importFeedItems } from '../dist/index.js';

class MemoryRepository {
  constructor() {
    this.contents = new Map();
  }

  async get(id) {
    return this.contents.get(id);
  }

  async save(content) {
    this.contents.set(content.id, { ...content });
  }

  async delete(id) {
    this.contents.delete(id);
  }

  async list() {
    return [...this.contents.values()];
  }
}

const item = {
  id: 'feed:rss::article-1',
  feedId: 'feed:rss',
  guid: 'article-1',
  title: 'Imported article',
  url: 'https://example.org/article-1',
  description: '<p>Summary</p>',
  content: '<p>Body is kept on FeedItem for a later document pipeline.</p>',
  author: 'Author',
  publishedAt: 100,
  categories: ['tech', 'reading']
};

test('maps FeedItem to the existing Article Content contract', () => {
  assert.deepEqual(feedItemToArticle(item), {
    id: item.id,
    type: 'article',
    title: item.title,
    description: item.description,
    author: item.author,
    tags: item.categories,
    sourceId: item.feedId,
    createdAt: 100,
    updatedAt: 100
  });
});

test('imports items idempotently and preserves the original creation time', async () => {
  const repository = new MemoryRepository();
  await importFeedItems(repository, [item]);
  const updatedItem = { ...item, title: 'Updated article', publishedAt: 200 };
  const imported = await importFeedItems(repository, [updatedItem]);

  assert.equal(imported.length, 1);
  assert.equal(imported[0].title, 'Updated article');
  assert.equal(imported[0].createdAt, 100);
  assert.equal(imported[0].updatedAt, 200);
  assert.equal((await repository.list()).length, 1);
});

