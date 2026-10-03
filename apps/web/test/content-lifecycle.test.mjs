import assert from 'node:assert/strict';
import test from 'node:test';

import { ContentLifecycle } from '../dist/content-lifecycle.js';

function createRepositories({ failStateDelete = false } = {}) {
  const contents = new Map();
  const documents = new Map();
  const states = new Map();
  const controls = { failNextDocumentSave: false };

  return {
    contents: {
      get: async (id) => contents.get(id),
      save: async (value) => contents.set(value.id, value),
      delete: async (id) => contents.delete(id)
    },
    documents: {
      get: async (id) => documents.get(id),
      getByContentId: async (contentId) =>
        [...documents.values()].find((document) => document.contentId === contentId),
      save: async (value) => {
        if (controls.failNextDocumentSave) {
          controls.failNextDocumentSave = false;
          throw new Error('document write failed');
        }
        documents.set(value.id, value);
      },
      delete: async (id) => documents.delete(id)
    },
    states: {
      get: async (id) => states.get(id),
      save: async (value) => states.set(value.contentId, value),
      delete: async (id) => {
        if (failStateDelete) throw new Error('state delete failed');
        states.delete(id);
      }
    },
    contentsData: contents,
    documentsData: documents,
    statesData: states,
    controls
  };
}

const content = {
  id: 'content-1',
  type: 'article',
  title: 'Original',
  createdAt: 1,
  updatedAt: 1
};

const document = {
  id: 'document:content-1',
  contentId: 'content-1',
  version: 1,
  title: 'Original',
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

test('compensates a partial save and restores previous records', async () => {
  const repositories = createRepositories();
  await repositories.contents.save(content);
  await repositories.documents.save(document);
  repositories.controls.failNextDocumentSave = true;
  const lifecycle = new ContentLifecycle(
    repositories.contents,
    repositories.documents,
    repositories.states
  );

  await assert.rejects(
    () => lifecycle.save({ ...content, title: 'Updated' }, { ...document, title: 'Updated' }),
    /Unable to save content and document/
  );
  assert.equal(repositories.contentsData.get(content.id).title, 'Original');
  assert.equal(repositories.documentsData.get(document.id).title, 'Original');
});

test('compensates a partial delete and restores all related records', async () => {
  const repositories = createRepositories({ failStateDelete: true });
  await repositories.contents.save(content);
  await repositories.documents.save(document);
  await repositories.states.save(state);
  const lifecycle = new ContentLifecycle(
    repositories.contents,
    repositories.documents,
    repositories.states
  );

  await assert.rejects(
    () => lifecycle.delete(content.id),
    /Unable to delete content and related records/
  );
  assert.ok(repositories.contentsData.has(content.id));
  assert.ok(repositories.documentsData.has(document.id));
  assert.ok(repositories.statesData.has(content.id));
});
