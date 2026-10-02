import assert from 'node:assert/strict';
import test from 'node:test';

import { createArticleDocument, DOCUMENT_VERSION } from '../dist/index.js';

const article = {
  id: 'article-1',
  type: 'article',
  title: 'Reader Core',
  createdAt: 1,
  updatedAt: 1
};

test('creates a stable empty document without inferring description as body', () => {
  const document = createArticleDocument({
    ...article,
    description: 'This is metadata, not an implicit paragraph.'
  });

  assert.deepEqual(document, {
    id: 'document:article-1',
    contentId: 'article-1',
    version: DOCUMENT_VERSION,
    title: 'Reader Core',
    blocks: []
  });
});

test('normalizes explicit blocks with stable ids and preserves their data', () => {
  const document = createArticleDocument(article, {
    blocks: [
      { type: 'heading', level: 1, text: 'Hello' },
      { type: 'paragraph', text: 'Reader Core stays platform neutral.' },
      { type: 'list', ordered: false, items: ['one', 'two'] },
      { type: 'quote', text: 'Read locally.' },
      { type: 'code', code: 'const value = 1;', language: 'ts' },
      { type: 'image', src: 'https://example.org/image.png', alt: 'Example' },
      { type: 'divider' }
    ]
  });

  assert.deepEqual(document.blocks, [
    { id: 'block:1', type: 'heading', level: 1, text: 'Hello' },
    { id: 'block:2', type: 'paragraph', text: 'Reader Core stays platform neutral.' },
    { id: 'block:3', type: 'list', ordered: false, items: ['one', 'two'] },
    { id: 'block:4', type: 'quote', text: 'Read locally.' },
    { id: 'block:5', type: 'code', code: 'const value = 1;', language: 'ts' },
    { id: 'block:6', type: 'image', src: 'https://example.org/image.png', alt: 'Example' },
    { id: 'block:7', type: 'divider' }
  ]);
});

test('rejects unknown or malformed blocks', () => {
  assert.throws(
    () => createArticleDocument(article, { blocks: [{ type: 'unknown' }] }),
    /Invalid Reader block/
  );
  assert.throws(
    () => createArticleDocument(article, { blocks: [{ type: 'heading', level: 4, text: 'Invalid' }] }),
    /Invalid Reader block/
  );
});
