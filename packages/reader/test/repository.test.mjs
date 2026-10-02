import assert from 'node:assert/strict';
import test from 'node:test';

import { StorageDocumentRepository } from '../dist/index.js';

class MemoryCollection {
  constructor() {
    this.records = new Map();
  }

  async get(id) {
    return this.records.get(id);
  }

  async put(record) {
    this.records.set(record.id, {
      ...record,
      ...(Array.isArray(record.blocks)
        ? { blocks: record.blocks.map((block) => ({ ...block })) }
        : {})
    });
  }

  async delete(id) {
    this.records.delete(id);
  }

  async list(query = {}) {
    let records = [...this.records.values()];
    for (const [key, expected] of Object.entries(query.where ?? {})) {
      records = records.filter((record) => record[key] === expected);
    }
    return records.slice(query.offset ?? 0, query.limit === undefined ? undefined : (query.offset ?? 0) + query.limit);
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

const document = {
  id: 'document:article-1',
  contentId: 'article-1',
  version: 1,
  title: 'Persisted document',
  blocks: [
    { id: 'block:1', type: 'paragraph', text: 'Local first.' }
  ]
};

test('saves, finds by content, updates, and deletes documents', async () => {
  const repository = new StorageDocumentRepository(new MemoryStorage());

  await repository.save(document);
  assert.deepEqual(await repository.get(document.id), document);
  assert.deepEqual(await repository.getByContentId(document.contentId), document);

  const updated = { ...document, title: 'Updated document' };
  await repository.save(updated);
  assert.equal((await repository.get(document.id))?.title, 'Updated document');

  await repository.delete(document.id);
  assert.equal(await repository.get(document.id), undefined);
  assert.equal(await repository.getByContentId(document.contentId), undefined);
});

test('rejects malformed documents before persistence and on read', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageDocumentRepository(storage);

  await assert.rejects(
    () => repository.save({ ...document, version: 2 }),
    /Invalid Reader document/
  );
  await storage.collection('reader-documents').put({ id: 'broken', contentId: 'article-2' });
  await assert.rejects(() => repository.get('broken'), /Invalid Reader document/);
});
