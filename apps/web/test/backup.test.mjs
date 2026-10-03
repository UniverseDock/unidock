import assert from 'node:assert/strict';
import test from 'node:test';

import { BackupParseError, createBackupPayload, parseBackup } from '../dist/backup.js';

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
  assert.throws(
    () => parseBackup('{'),
    (error) => error instanceof BackupParseError &&
      error.code === 'invalid-json' &&
      /不是有效的 JSON/.test(error.message)
  );
  const payload = createBackupPayload([content], [document], [state], [feed]);
  payload.documents[0].blocks = [{ id: 'block:1', type: 'unknown' }];
  assert.throws(() => parseBackup(JSON.stringify(payload)), /包含无效数据/);
});

test('keeps the established v1 fixture compatible', () => {
  const oldV1Fixture = JSON.stringify({
    format: 'unidock-backup',
    version: 1,
    exportedAt: '2026-01-15T08:30:00.000Z',
    contents: [{
      id: 'content:legacy-1',
      type: 'article',
      title: 'Legacy v1 article',
      createdAt: 100,
      updatedAt: 200
    }],
    documents: [{
      id: 'document:content:legacy-1',
      contentId: 'content:legacy-1',
      version: 1,
      title: 'Legacy v1 article',
      blocks: [{ id: 'block:legacy-1', type: 'paragraph', text: 'Legacy body' }]
    }],
    states: [{
      id: 'content:legacy-1',
      contentId: 'content:legacy-1',
      documentId: 'document:content:legacy-1',
      documentVersion: 1,
      read: false,
      starred: true,
      updatedAt: 201
    }],
    feeds: []
  });

  assert.equal(parseBackup(oldV1Fixture).version, 1);
  assert.equal(parseBackup(oldV1Fixture).contents[0].title, 'Legacy v1 article');
});

test('distinguishes invalid, missing, and unsupported backup versions without changing input', () => {
  const valid = JSON.stringify(createBackupPayload([content], [document], [state], [feed]));
  const cases = [
    [JSON.stringify({ ...JSON.parse(valid), version: 2 }), 'unsupported-version'],
    [JSON.stringify({ ...JSON.parse(valid), version: 0 }), 'unsupported-version'],
    [JSON.stringify({ ...JSON.parse(valid), version: '1' }), 'invalid-version'],
    [JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(valid)).filter(([key]) => key !== 'version'))), 'missing-version'],
    [JSON.stringify({ ...JSON.parse(valid), format: 'other' }), 'invalid-envelope']
  ];

  for (const [text, code] of cases) {
    const before = text;
    assert.throws(
      () => parseBackup(text),
      (error) => error instanceof BackupParseError && error.code === code
    );
    assert.equal(text, before);
  }
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
