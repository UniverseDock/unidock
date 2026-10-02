import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseFeed } from '../dist/index.js';

const rss = await readFile(new URL('./fixtures/rss.xml', import.meta.url), 'utf8');
const atom = await readFile(new URL('./fixtures/atom.xml', import.meta.url), 'utf8');

test('parses RSS 2.0 fields, CDATA, relative URLs and repeated categories', () => {
  const feed = parseFeed(rss, {
    feedUrl: 'https://example.com/feed.xml',
    feedId: 'feed:rss'
  });

  assert.equal(feed.format, 'rss2');
  assert.equal(feed.title, 'UniDock Journal');
  assert.equal(feed.siteUrl, 'https://example.com/site');
  assert.equal(feed.items.length, 1);
  assert.deepEqual(feed.items[0], {
    id: 'feed:rss::article-first',
    feedId: 'feed:rss',
    guid: 'article-first',
    title: 'First article',
    url: 'https://example.com/articles/first',
    description: '<p>Summary</p>',
    content: '<p>Full content</p>',
    author: 'Author One',
    publishedAt: Date.parse('Tue, 01 Oct 2024 12:00:00 GMT'),
    imageUrl: 'https://example.com/images/first.png',
    categories: ['tech', 'reading']
  });
});

test('parses Atom links, author, dates, categories and content', () => {
  const feed = parseFeed(atom, { feedUrl: 'https://example.org/feed.atom' });
  const item = feed.items[0];

  assert.equal(feed.format, 'atom');
  assert.equal(feed.siteUrl, 'https://example.org/');
  assert.equal(item.url, 'https://example.org/entries/one');
  assert.equal(item.author, 'Atom Author');
  assert.equal(item.content, '<p>Atom content</p>');
  assert.deepEqual(item.categories, ['atom']);
});

test('rejects empty and unsupported feeds', () => {
  assert.throws(
    () => parseFeed(' ', { feedUrl: 'https://example.org/feed.xml' }),
    /must not be empty/
  );
  assert.throws(
    () => parseFeed('<html></html>', { feedUrl: 'https://example.org/feed.xml' }),
    /Unsupported feed format/
  );
});
