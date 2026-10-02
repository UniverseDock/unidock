import assert from 'node:assert/strict';
import test from 'node:test';

import { IndexedDBAdapter } from '../dist/index.js';

test('exposes the IndexedDB adapter id', () => {
  assert.equal(new IndexedDBAdapter().id, 'indexeddb');
});

test('reports a clear error when IndexedDB is unavailable', async () => {
  const adapter = new IndexedDBAdapter({ indexedDB: undefined });

  await assert.rejects(
    () => adapter.create(),
    {
      message: 'IndexedDB is not available in this environment.'
    }
  );
});

test('destroy is safe before the adapter is created', async () => {
  await assert.doesNotReject(() => new IndexedDBAdapter().destroy());
});
