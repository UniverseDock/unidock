import assert from 'node:assert/strict';
import test from 'node:test';

import { feedItemToDocument, htmlToBlocks } from '../dist/index.js';

const content = {
  id: 'feed:rss::article-1',
  type: 'article',
  title: 'Imported article',
  createdAt: 100,
  updatedAt: 100
};

const item = {
  id: content.id,
  feedId: 'feed:rss',
  guid: 'article-1',
  title: content.title,
  url: 'https://example.org/article-1',
  description: '<p>Summary</p>',
  content: '<h2>Heading</h2><p>Body <strong>text</strong>.</p><ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote><pre>const x = 1;</pre><img src="/image.png" alt="Image"><hr>',
  categories: []
};

test('converts supported HTML structures into Reader blocks', () => {
  assert.deepEqual(htmlToBlocks(item.content, item.url), [
    { type: 'heading', level: 2, text: 'Heading' },
    { type: 'paragraph', text: 'Body text.' },
    { type: 'list', ordered: false, items: ['One', 'Two'] },
    { type: 'quote', text: 'Quote' },
    { type: 'code', code: 'const x = 1;' },
    { type: 'image', src: 'https://example.org/image.png', alt: 'Image' },
    { type: 'divider' }
  ]);
});

test('keeps unsafe images out and prefers full content over description', () => {
  const document = feedItemToDocument({
    ...item,
    content: '<img src="javascript:alert(1)"><p>Full content</p>',
    description: '<p>Summary should not be used.</p>'
  }, content);

  assert.deepEqual(document.blocks, [
    { id: 'block:1', type: 'paragraph', text: 'Full content' }
  ]);
});

test('uses description when FeedItem has no full content', () => {
  const document = feedItemToDocument({
    ...item,
    content: undefined,
    description: '<p>Summary fallback</p>'
  }, content);

  assert.deepEqual(document.blocks, [
    { id: 'block:1', type: 'paragraph', text: 'Summary fallback' }
  ]);
});
