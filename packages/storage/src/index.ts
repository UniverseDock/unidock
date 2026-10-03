export type {
  Storage,
  StorageAdapter,
  StorageCollection,
  StorageQuery,
  StorageRecord
} from './types.js';
export { StorageError, toStorageError } from './errors.js';
export type { StorageErrorCode } from './errors.js';
export { IndexedDBAdapter, INDEXEDDB_SCHEMA_VERSION } from './indexeddb/adapter.js';
export type { IndexedDBAdapterOptions } from './indexeddb/adapter.js';
export { IndexedDBStorage } from './indexeddb/storage.js';
