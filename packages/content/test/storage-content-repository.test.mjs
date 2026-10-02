import assert from 'node:assert/strict';
import test from 'node:test';

import { StorageContentRepository } from '../dist/repository/storage-content-repository.js';

class MemoryCollection {
  constructor() {
    this.records = new Map();
  }

  async get(id) {
    return this.records.get(id);
  }

  async put(record) {
    this.records.set(record.id, { ...record });
  }

  async delete(id) {
    this.records.delete(id);
  }

  async list(query = {}) {
    let records = [...this.records.values()];
    for (const [key, expected] of Object.entries(query.where ?? {})) {
      records = records.filter((record) => record[key] === expected);
    }
    const offset = Math.max(0, query.offset ?? 0);
    const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit);
    return records.slice(offset, end);
  }

  async clear() {
    this.records.clear();
  }
}

class MemoryStorage {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    let collection = this.collections.get(name);
    if (!collection) {
      collection = new MemoryCollection();
      this.collections.set(name, collection);
    }
    return collection;
  }

  close() {}
}

function content(id, overrides = {}) {
  return {
    id,
    type: 'article',
    title: `Article ${id}`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

test('saves, reads, updates, and deletes content', async () => {
  const repository = new StorageContentRepository(new MemoryStorage());
  const original = content('article-1', { tags: ['typescript'] });

  await repository.save(original);
  assert.deepEqual(await repository.get(original.id), original);

  const updated = { ...original, title: 'Updated article' };
  await repository.save(updated);
  assert.deepEqual(await repository.get(original.id), updated);

  await repository.delete(original.id);
  assert.equal(await repository.get(original.id), undefined);
});

test('filters by type, source, and all requested tags, then paginates', async () => {
  const repository = new StorageContentRepository(new MemoryStorage());
  await repository.save(content('article-1', {
    sourceId: 'feed-a',
    tags: ['typescript', 'storage']
  }));
  await repository.save(content('article-2', {
    sourceId: 'feed-a',
    tags: ['typescript', 'reader']
  }));
  await repository.save(content('article-3', {
    sourceId: 'feed-b',
    tags: ['typescript', 'storage']
  }));
  await repository.save(content('book-1', {
    type: 'book',
    sourceId: 'feed-a',
    tags: ['typescript', 'storage']
  }));

  const result = await repository.list({
    type: 'article',
    sourceId: 'feed-a',
    tags: ['typescript', 'storage'],
    offset: 0,
    limit: 1
  });

  assert.deepEqual(result.map((item) => item.id), ['article-1']);
});

test('returns an empty result for unmatched filters and non-positive limits', async () => {
  const repository = new StorageContentRepository(new MemoryStorage());
  await repository.save(content('article-1', { sourceId: 'feed-a' }));

  assert.deepEqual(await repository.list({ sourceId: 'missing' }), []);
  assert.deepEqual(await repository.list({ limit: 0 }), []);
  assert.deepEqual(await repository.list({ offset: -1, limit: -1 }), []);
});

test('rejects malformed content records before persistence and on read', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageContentRepository(storage);

  await assert.rejects(
    () => repository.save(content('missing-title', { title: undefined })),
    /Invalid Content record/
  );
  await storage.collection('contents').put({ id: 'broken', type: 'article' });
  await assert.rejects(() => repository.get('broken'), /Invalid Content record/);
});
