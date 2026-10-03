import assert from 'node:assert/strict';
import test from 'node:test';

import { IndexedDBAdapter, IndexedDBStorage, StorageError } from '../dist/index.js';

test('exposes the IndexedDB adapter id', () => {
  assert.equal(new IndexedDBAdapter().id, 'indexeddb');
});

test('reports a clear error when IndexedDB is unavailable', async () => {
  const adapter = new IndexedDBAdapter({ indexedDB: undefined });

  await assert.rejects(
    () => adapter.create(),
    (error) => error instanceof StorageError &&
      error.code === 'unavailable' &&
      error.operation === 'open' &&
      error.message === 'IndexedDB is not available in this environment.'
  );
});

test('wraps synchronous factory.open failures and preserves cause', async () => {
  const cause = new Error('open exploded');
  const adapter = new IndexedDBAdapter({
    indexedDB: { open() { throw cause; } }
  });

  await assert.rejects(() => adapter.create(), (error) =>
    error instanceof StorageError &&
    error.code === 'open-failed' &&
    error.operation === 'open' &&
    error.cause === cause
  );
});

test('classifies storage request failures with an operation', async () => {
  const adapter = new IndexedDBAdapter({
    indexedDB: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.error = new Error('open failed');
          request.onerror();
        });
        return request;
      }
    }
  });

  await assert.rejects(
    () => adapter.create(),
    (error) => error instanceof StorageError &&
      error.code === 'open-failed' &&
      error.operation === 'open'
  );
});

test('closes a database delivered after a blocked open was rejected', async () => {
  let closed = 0;
  const request = {};
  const adapter = new IndexedDBAdapter({
    indexedDB: {
      open() {
        queueMicrotask(() => request.onblocked());
        queueMicrotask(() => {
          request.result = { close() { closed += 1; } };
          request.onsuccess();
        });
        return request;
      }
    }
  });

  await assert.rejects(() => adapter.create(), (error) =>
    error instanceof StorageError && error.code === 'open-blocked'
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, 1);
});

test('classifies quota errors without losing the original cause', async () => {
  const cause = new DOMException('full', 'QuotaExceededError');
  const adapter = new IndexedDBAdapter({
    indexedDB: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.error = cause;
          request.onerror();
        });
        return request;
      }
    }
  });

  await assert.rejects(() => adapter.create(), (error) =>
    error instanceof StorageError &&
    error.code === 'quota-exceeded' &&
    error.cause === cause
  );
});

test('does not label version conflicts or closed databases as corruption', () => {
  assert.equal(new StorageError('x', 'version-conflict', 'open').code, 'version-conflict');
});

function fakeRequest({ result, error } = {}) {
  return {
    result,
    error,
    onsuccess: null,
    onerror: null,
    fireSuccess() { queueMicrotask(() => this.onsuccess?.()); },
    fireError() { queueMicrotask(() => this.onerror?.()); }
  };
}

function fakeDatabase({ request, abortError } = {}) {
  const store = {
    get: () => request,
    getAll: () => request,
    put: () => request,
    delete: () => request,
    index: () => ({ getAll: () => request, openKeyCursor: () => request })
  };
  return {
    transaction() {
      const transaction = {
        error: abortError,
        oncomplete: null,
        onabort: null,
        objectStore: () => store,
        abort() { queueMicrotask(() => this.onabort?.()); }
      };
      return transaction;
    },
    close() {}
  };
}

test('reports fake transaction aborts through the CRUD contract', async () => {
  const request = fakeRequest();
  const cause = new DOMException('aborted', 'AbortError');
  const database = fakeDatabase({ request, abortError: cause });
  const collection = new IndexedDBStorage(database).collection('fake');
  database.transaction = () => {
    const transaction = fakeDatabase({ request, abortError: cause }).transaction();
    queueMicrotask(() => transaction.onabort?.());
    return transaction;
  };

  await assert.rejects(() => collection.get('id'), (error) =>
    error instanceof StorageError &&
    error.code === 'transaction-failed' &&
    error.cause === cause
  );
});

test('passes fake request failures and quota errors through the transaction helper', async () => {
  for (const cause of [
    new Error('request failed'),
    new DOMException('full', 'QuotaExceededError')
  ]) {
    const request = fakeRequest({ error: cause });
    const database = fakeDatabase({ request, abortError: cause });
    database.transaction = () => {
      const transaction = fakeDatabase({ request, abortError: cause }).transaction();
      queueMicrotask(() => {
        request.onerror?.();
        transaction.onabort?.();
      });
      return transaction;
    };
    const collection = new IndexedDBStorage(database).collection('fake');
    await assert.rejects(() => collection.list(), (error) =>
      error instanceof StorageError &&
      error.cause === cause &&
      error.code === (cause.name === 'QuotaExceededError' ? 'quota-exceeded' : 'request-failed')
    );
  }
});

test('aborts and consumes the transaction when put setup throws synchronously', async () => {
  let aborted = false;
  const cause = new DOMException('clone failed', 'DataCloneError');
  const database = {
    transaction() {
      const transaction = {
        error: cause,
        oncomplete: null,
        onabort: null,
        objectStore: () => ({ put() { throw cause; } }),
        abort() {
          aborted = true;
          queueMicrotask(() => transaction.onabort?.());
        }
      };
      return transaction;
    }
  };

  const collection = new IndexedDBStorage(database).collection('fake');
  await assert.rejects(() => collection.put({ id: 'clone' }), (error) =>
    error instanceof StorageError &&
    error.code === 'request-failed' &&
    error.cause === cause
  );
  assert.equal(aborted, true);
});

test('destroy is safe before the adapter is created', async () => {
  await assert.doesNotReject(() => new IndexedDBAdapter().destroy());
});
