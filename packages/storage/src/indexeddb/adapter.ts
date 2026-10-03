import type { Storage, StorageAdapter } from '../types.js';
import { StorageError, toStorageError } from '../errors.js';
import { IndexedDBStorage } from './storage.js';

export const INDEXEDDB_SCHEMA_VERSION = 1;

export interface IndexedDBAdapterOptions {
  databaseName?: string;
  indexedDB?: IDBFactory;
}

export class IndexedDBAdapter implements StorageAdapter {
  readonly id = 'indexeddb';
  private database: IDBDatabase | undefined;

  constructor(private readonly options: IndexedDBAdapterOptions = {}) {}

  async create(): Promise<Storage> {
    const factory = this.options.indexedDB ?? globalThis.indexedDB;
    if (!factory) {
      throw new StorageError(
        'IndexedDB is not available in this environment.',
        'unavailable',
        'open'
      );
    }

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(
        this.options.databaseName ?? 'unidock',
        INDEXEDDB_SCHEMA_VERSION
      );
    } catch (error) {
      throw toStorageError(error, 'open', 'open-failed');
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('records')) {
        const records = database.createObjectStore('records', {
          keyPath: ['collection', 'id']
        });
        records.createIndex('by-collection', 'collection', { unique: false });
      }
    };

    const database = await requestToPromise(request);
    this.database = database;
    database.onversionchange = () => database.close();
    return new IndexedDBStorage(database);
  }

  async destroy(): Promise<void> {
    this.database?.close();
    this.database = undefined;
  }
}

function requestToPromise(request: IDBOpenDBRequest): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database?.close();
        return;
      }
      settled = true;
      resolve(database);
    };
    request.onerror = () => reject(toStorageError(
      request.error ?? new Error('Unable to open IndexedDB.'),
      'open',
      'open-failed'
    ));
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new StorageError(
        'Opening the UniDock database was blocked by another browser context.',
        'open-blocked',
        'open'
      ));
    };
  });
}
