import type { Storage, StorageCollection, StorageQuery, StorageRecord } from '../types.js';

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
    const transaction = this.database.transaction(STORE_NAME, 'readonly');
    const transactionDone = transactionToPromise(transaction);
    const request = transaction.objectStore(STORE_NAME).get([this.name, id]) as IDBRequest<StoredRecord<T> | undefined>;
    const result = await requestToPromise(request);
    await transactionDone;
    return result?.value;
  }

  async put(record: T): Promise<void> {
    const transaction = this.database.transaction(STORE_NAME, 'readwrite');
    const transactionDone = transactionToPromise(transaction);
    transaction.objectStore(STORE_NAME).put({ collection: this.name, id: record.id, value: record } satisfies StoredRecord<T>);
    await transactionDone;
  }

  async delete(id: string): Promise<void> {
    const transaction = this.database.transaction(STORE_NAME, 'readwrite');
    const transactionDone = transactionToPromise(transaction);
    transaction.objectStore(STORE_NAME).delete([this.name, id]);
    await transactionDone;
  }

  async list(query: StorageQuery = {}): Promise<T[]> {
    const transaction = this.database.transaction(STORE_NAME, 'readonly');
    const transactionDone = transactionToPromise(transaction);
    const index = transaction.objectStore(STORE_NAME).index('by-collection');
    const request = index.getAll(this.name) as IDBRequest<StoredRecord<T>[]>;
    const rows = await requestToPromise(request);
    await transactionDone;

    const filtered = rows.map((row) => row.value).filter((record) =>
      Object.entries(query.where ?? {}).every(([key, value]) => valuesMatch(record[key], value))
    );
    const offset = Math.max(0, query.offset ?? 0);
    const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit);
    return filtered.slice(offset, end);
  }

  async clear(): Promise<void> {
    const transaction = this.database.transaction(STORE_NAME, 'readwrite');
    const transactionDone = transactionToPromise(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.index('by-collection').openKeyCursor(this.name);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionDone;
  }
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && !Array.isArray(expected)) return actual.includes(expected);
  return actual === expected;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}
