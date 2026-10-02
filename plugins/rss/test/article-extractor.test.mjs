import assert from 'node:assert/strict';
import test from 'node:test';

import { extractArticle } from '../dist/index.js';

test('extracts the main article and converts it to Reader blocks', () => {
  const result = extractArticle(`
    <html>
      <head><title>Example article</title></head>
      <body>
        <nav>Navigation should be removed</nav>
        <main>
          <article>
            <h1>Example article</h1>
            <p>First paragraph with useful content.</p>
            <p>Second paragraph with more detail.</p>
          </article>
        </main>
        <footer>Footer should be removed</footer>
      </body>
    </html>
  `, 'https://example.org/a/1');

  assert.ok(result);
  assert.match(result.contentHtml, /First paragraph/);
  assert.doesNotMatch(result.contentHtml, /Navigation should be removed/);
  assert.deepEqual(result.blocks, [
    { type: 'paragraph', text: 'First paragraph with useful content.' },
    { type: 'paragraph', text: 'Second paragraph with more detail.' }
  ]);
});

test('returns undefined when no readable article is present', () => {
  assert.equal(extractArticle('', 'https://example.org'), undefined);
});
