import assert from 'node:assert/strict';
import test from 'node:test';

import { StorageReadingStateRepository } from '../dist/index.js';

class MemoryCollection {
  constructor() {
    this.records = new Map();
  }

  async get(id) {
    return this.records.get(id);
  }

  async put(record) {
    this.records.set(record.id, structuredClone(record));
  }

  async delete(id) {
    this.records.delete(id);
  }

  async list() {
    return [...this.records.values()];
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

const state = {
  contentId: 'article-1',
  documentId: 'document:article-1',
  documentVersion: 1,
  position: {
    blockId: 'block:2',
    offset: 18
  },
  read: true,
  starred: true,
  updatedAt: 100
};

test('saves, reads, updates, and deletes reading state by content id', async () => {
  const repository = new StorageReadingStateRepository(new MemoryStorage());

  await repository.save(state);
  assert.deepEqual(await repository.get(state.contentId), state);

  const updated = { ...state, position: undefined, starred: false, updatedAt: 200 };
  await repository.save(updated);
  assert.deepEqual(await repository.get(state.contentId), updated);

  await repository.delete(state.contentId);
  assert.equal(await repository.get(state.contentId), undefined);
});

test('rejects invalid position and malformed persisted state', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageReadingStateRepository(storage);

  await assert.rejects(
    () => repository.save({ ...state, position: { blockId: 'block:1', offset: -1 } }),
    /Invalid reading state/
  );
  await storage.collection('reader-state').put({
    id: 'broken',
    contentId: 'broken',
    documentId: 'document:broken',
    documentVersion: 1,
    read: 'yes',
    starred: false,
    updatedAt: 100
  });
  await assert.rejects(() => repository.get('broken'), /Invalid reading state/);
});
