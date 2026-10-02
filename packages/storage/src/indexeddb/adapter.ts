import type { Storage, StorageAdapter } from '../types.js';
import { IndexedDBStorage } from './storage.js';

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
      throw new Error('IndexedDB is not available in this environment.');
    }

    const request = factory.open(this.options.databaseName ?? 'unidock', 1);
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

function requestToPromise<T>(request: IDBOpenDBRequest): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
    request.onblocked = () => reject(new Error('Opening the UniDock database was blocked.'));
  });
}
