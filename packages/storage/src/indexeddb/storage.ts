import type { Storage, StorageCollection, StorageQuery, StorageRecord } from '../types.js';
import { StorageError, toStorageError } from '../errors.js';

interface StoredRecord<T extends StorageRecord = StorageRecord> {
  collection: string;
  id: string;
  value: T;
}

const STORE_NAME = 'records';

export class IndexedDBStorage implements Storage {
  constructor(private readonly database: IDBDatabase) {}

  collection<T extends StorageRecord = StorageRecord>(name: string): StorageCollection<T> {
    if (!name.trim()) throw new Error('Collection name must not be empty.');
    return new IndexedDBCollection<T>(this.database, name);
  }

  close(): void {
    this.database.close();
  }
}

class IndexedDBCollection<T extends StorageRecord> implements StorageCollection<T> {
  constructor(private readonly database: IDBDatabase, private readonly name: string) {}

  async get(id: string): Promise<T | undefined> {
    try {
      const result = await runTransaction(
        this.database,
        'readonly',
        `get:${this.name}`,
        (transaction) => transaction.objectStore(STORE_NAME)
          .get([this.name, id]) as IDBRequest<StoredRecord<T> | undefined>
      );
      return result?.value;
    } catch (error) {
      throw toStorageError(error, `get:${this.name}`);
    }
  }

  async put(record: T): Promise<void> {
    try {
      await runTransaction(
        this.database,
        'readwrite',
        `put:${this.name}`,
        (transaction) => transaction.objectStore(STORE_NAME).put(
          { collection: this.name, id: record.id, value: record } satisfies StoredRecord<T>
        )
      );
    } catch (error) {
      throw toStorageError(error, `put:${this.name}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await runTransaction(
        this.database,
        'readwrite',
        `delete:${this.name}`,
        (transaction) => transaction.objectStore(STORE_NAME).delete([this.name, id])
      );
    } catch (error) {
      throw toStorageError(error, `delete:${this.name}`);
    }
  }

  async list(query: StorageQuery = {}): Promise<T[]> {
    try {
      const rows = await runTransaction(
        this.database,
        'readonly',
        `list:${this.name}`,
        (transaction) => transaction.objectStore(STORE_NAME)
          .index('by-collection')
          .getAll(this.name) as IDBRequest<StoredRecord<T>[]>
      );

      const filtered = rows
        .map((row) => row.value)
        .filter((record) =>
          Object.entries(query.where ?? {}).every(([key, value]) => valuesMatch(record[key], value))
        )
        .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
      const offset = Math.max(0, query.offset ?? 0);
      const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit);
      return filtered.slice(offset, end);
    } catch (error) {
      throw toStorageError(error, `list:${this.name}`);
    }
  }

  async clear(): Promise<void> {
    try {
      await runTransaction(
        this.database,
        'readwrite',
        `clear:${this.name}`,
        (transaction) => {
          const store = transaction.objectStore(STORE_NAME);
          const request = store.index('by-collection').openKeyCursor(this.name);
          return cursorRequestToPromise(request, store, `clear:${this.name}`);
        }
      );
    } catch (error) {
      throw toStorageError(error, `clear:${this.name}`);
    }
  }
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && !Array.isArray(expected)) return actual.includes(expected);
  return actual === expected;
}

function runTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: string,
  setup: (transaction: IDBTransaction) => Promise<T> | IDBRequest<T>
): Promise<T> {
  let transaction: IDBTransaction;
  let transactionDone: Promise<void>;
  try {
    transaction = database.transaction(STORE_NAME, mode);
    transactionDone = transactionToPromise(transaction, operation);
  } catch (error) {
    throw toStorageError(error, operation, 'transaction-failed');
  }

  let requestPromise: Promise<T>;
  try {
    const request = setup(transaction);
    requestPromise = request instanceof Promise
      ? request
      : requestToPromise(request, operation);
  } catch (error) {
    abortAndConsume(transaction, transactionDone);
    return Promise.reject(toStorageError(error, operation));
  }

  return Promise.all([requestPromise, transactionDone]).then(
    ([result]) => result,
    async (error) => {
      abortAndConsume(transaction, transactionDone);
      const transactionError = await transactionDone.catch((failure) => failure);
      if (isAbortError(error) && transactionError instanceof Error) {
        throw transactionError;
      }
      throw error;
    }
  );
}

function requestToPromise<T>(request: IDBRequest<T>, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      const error = request.error ?? new Error('IndexedDB request failed.');
      reject(toStorageError(
        error,
        operation,
        error instanceof DOMException && error.name === 'AbortError'
          ? 'transaction-failed'
          : 'request-failed'
      ));
    };
  });
}

function cursorRequestToPromise(
  request: IDBRequest<IDBCursor | null>,
  store: IDBObjectStore,
  operation: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      const error = request.error ?? new Error('IndexedDB cursor request failed.');
      reject(toStorageError(
        error,
        operation,
        error instanceof DOMException && error.name === 'AbortError'
          ? 'transaction-failed'
          : 'request-failed'
      ));
    };
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      } catch (error) {
        reject(toStorageError(error, operation));
      }
    };
  });
}

function abortAndConsume(transaction: IDBTransaction, transactionDone: Promise<void>): void {
  try {
    transaction.abort();
  } catch {
    // The transaction may already be complete or aborted.
  }
  void transactionDone.catch(() => undefined);
}

function transactionToPromise(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(toStorageError(
      transaction.error ?? new Error('IndexedDB transaction aborted.'),
      operation,
      'transaction-failed'
    ));
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof StorageError &&
    error.cause instanceof DOMException &&
    error.cause.name === 'AbortError';
}
