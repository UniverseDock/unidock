import assert from 'node:assert/strict';
import test from 'node:test';

import { BackupRestoreError, BackupRestoreService } from '../dist/backup-restore.js';

function collection(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: async (id) => values.get(id),
    put: async (record) => {
      if (controls.failNextDocumentPut) {
        controls.failNextDocumentPut = false;
        throw new Error('document write failed');
      }
      values.set(record.id, record);
    },
    delete: async (id) => values.delete(id)
  };
}

const controls = { failNextDocumentPut: false };

function createFixture() {
  const content = {
    id: 'content-1',
    type: 'article',
    title: 'Old content',
    createdAt: 1,
    updatedAt: 1
  };
  const document = {
    id: 'document:content-1',
    contentId: 'content-1',
    version: 1,
    title: 'Old content',
    blocks: []
  };
  const state = {
    contentId: 'content-1',
    documentId: 'document:content-1',
    documentVersion: 1,
    read: true,
    starred: true,
    updatedAt: 1
  };
  const feed = {
    id: 'feed:https://example.test/feed.xml',
    url: 'https://example.test/feed.xml',
    title: 'Old feed',
    updatedAt: 1
  };
  const contents = collection({ [content.id]: content });
  const documents = collection({ [document.id]: document });
  const feeds = collection({ [feed.id]: feed });
  const states = new Map([[state.contentId, state]]);

  return {
    content,
    document,
    state,
    feed,
    contents: {
      values: contents.values,
      get: contents.get,
      save: contents.put,
      delete: contents.delete
    },
    contentsData: contents.values,
    documents,
    feeds,
    states: {
      get: async (id) => states.get(id),
      save: async (value) => states.set(value.contentId, value),
      delete: async (id) => states.delete(id)
    },
    statesData: states
  };
}

function payload() {
  return {
    format: 'unidock-backup',
    version: 1,
    exportedAt: '2026-10-03T00:00:00.000Z',
    contents: [{
      id: 'content-1',
      type: 'article',
      title: 'New content',
      createdAt: 1,
      updatedAt: 2
    }],
    documents: [{
      id: 'document:content-1',
      contentId: 'content-1',
      version: 1,
      title: 'New content',
      blocks: []
    }],
    states: [{
      id: 'content-1',
      contentId: 'content-1',
      documentId: 'document:content-1',
      documentVersion: 1,
      read: false,
      starred: false,
      updatedAt: 2
    }],
    feeds: [{
      id: 'feed:https://example.test/feed.xml',
      url: 'https://example.test/feed.xml',
      title: 'New feed',
      updatedAt: 2
    }]
  };
}

test('restores every touched collection after a partial backup failure', async () => {
  const fixture = createFixture();
  controls.failNextDocumentPut = true;
  const service = new BackupRestoreService({
    contents: fixture.contents,
    documents: fixture.documents,
    states: fixture.states,
    feeds: fixture.feeds
  });

  await assert.rejects(
    () => service.restore(payload()),
    (error) => error instanceof BackupRestoreError &&
      /previous records were restored/.test(error.message)
  );
  assert.equal(fixture.contentsData.get('content-1').title, 'Old content');
  assert.equal(fixture.documents.values.get('document:content-1').title, 'Old content');
  assert.equal(fixture.statesData.get('content-1').read, true);
  assert.equal(fixture.feeds.values.get('feed:https://example.test/feed.xml').title, 'Old feed');
});

test('restores a valid backup across all collections', async () => {
  const fixture = createFixture();
  const service = new BackupRestoreService({
    contents: fixture.contents,
    documents: fixture.documents,
    states: fixture.states,
    feeds: fixture.feeds
  });

  await service.restore(payload());
  assert.equal(fixture.contentsData.get('content-1').title, 'New content');
  assert.equal(fixture.documents.values.get('document:content-1').title, 'New content');
  assert.equal(fixture.statesData.get('content-1').read, false);
  assert.equal(fixture.feeds.values.get('feed:https://example.test/feed.xml').title, 'New feed');
});

test('rejects an unsupported version before any restore write', async () => {
  const fixture = createFixture();
  const before = {
    content: fixture.contentsData.get('content-1'),
    document: fixture.documents.values.get('document:content-1'),
    state: fixture.statesData.get('content-1'),
    feed: fixture.feeds.values.get('feed:https://example.test/feed.xml')
  };
  const service = new BackupRestoreService({
    contents: fixture.contents,
    documents: fixture.documents,
    states: fixture.states,
    feeds: fixture.feeds
  });

  await assert.rejects(
    () => service.restoreText(JSON.stringify({ ...payload(), version: 2 })),
    (error) => error?.name === 'BackupParseError' && error.code === 'unsupported-version'
  );
  assert.deepEqual(fixture.contentsData.get('content-1'), before.content);
  assert.deepEqual(fixture.documents.values.get('document:content-1'), before.document);
  assert.deepEqual(fixture.statesData.get('content-1'), before.state);
  assert.deepEqual(fixture.feeds.values.get('feed:https://example.test/feed.xml'), before.feed);
});
