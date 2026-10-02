import assert from 'node:assert/strict';
import test from 'node:test';

import { createBackupPayload, parseBackup } from '../dist/backup.js';

const content = {
  id: 'content:1',
  type: 'article',
  title: 'Local article',
  tags: ['reading'],
  createdAt: 1,
  updatedAt: 2
};

const document = {
  id: 'document:content:1',
  contentId: 'content:1',
  version: 1,
  title: 'Local article',
  blocks: [{ id: 'block:1', type: 'paragraph', text: 'Body' }]
};

const state = {
  id: 'content:1',
  contentId: 'content:1',
  documentId: document.id,
  documentVersion: 1,
  read: true,
  starred: false,
  updatedAt: 3
};

const feed = {
  id: 'feed:https://example.org/feed.xml',
  url: 'https://example.org/feed.xml',
  title: 'Example',
  updatedAt: 4
};

test('creates and parses a valid backup payload', () => {
  const payload = createBackupPayload([content], [document], [state], [feed], '2026-10-02T00:00:00.000Z');
  assert.deepEqual(parseBackup(JSON.stringify(payload)), payload);
});

test('rejects malformed JSON and invalid reader blocks', () => {
  assert.throws(() => parseBackup('{'), /不是有效的 JSON/);
  const payload = createBackupPayload([content], [document], [state], [feed]);
  payload.documents[0].blocks = [{ id: 'block:1', type: 'unknown' }];
  assert.throws(() => parseBackup(JSON.stringify(payload)), /包含无效数据/);
});

test('rejects unsafe feed and image URLs', () => {
  const payload = createBackupPayload([content], [document], [state], [feed]);
  payload.feeds[0].url = 'javascript:alert(1)';
  assert.throws(() => parseBackup(JSON.stringify(payload)), /包含无效数据/);
});

test('rejects duplicate IDs and broken cross-record references', () => {
  const payload = createBackupPayload([content], [document], [state], [feed]);
  payload.contents.push({ ...content });
  assert.throws(() => parseBackup(JSON.stringify(payload)), /包含无效数据/);

  const broken = createBackupPayload([content], [document], [state], [feed]);
  broken.documents[0].contentId = 'content:missing';
  assert.throws(() => parseBackup(JSON.stringify(broken)), /包含无效数据/);

  const brokenDocumentId = createBackupPayload([content], [document], [state], [feed]);
  brokenDocumentId.documents[0].id = 'document:other';
  assert.throws(() => parseBackup(JSON.stringify(brokenDocumentId)), /包含无效数据/);
});
