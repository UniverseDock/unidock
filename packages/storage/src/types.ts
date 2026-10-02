export interface StorageRecord {
  id: string;
  [key: string]: unknown;
}

export interface StorageQuery {
  limit?: number;
  offset?: number;
  where?: Record<string, unknown>;
}

export interface StorageCollection<T extends StorageRecord = StorageRecord> {
  get(id: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(query?: StorageQuery): Promise<T[]>;
  clear(): Promise<void>;
}

export interface Storage {
  collection<T extends StorageRecord = StorageRecord>(name: string): StorageCollection<T>;
  close(): void;
}

export interface StorageAdapter {
  readonly id: string;
  create(): Promise<Storage>;
  destroy?(): Promise<void>;
}
