import type { Storage, StorageRecord } from '@unidock/storage';

const STATE_COLLECTION = 'reader-state';

export interface ReadingPosition {
  blockId: string;
  offset: number;
}

export interface ReadingState {
  contentId: string;
  documentId: string;
  documentVersion: number;
  position?: ReadingPosition;
  read: boolean;
  starred: boolean;
  updatedAt: number;
}

export interface ReadingStateRepository {
  get(contentId: string): Promise<ReadingState | undefined>;
  save(state: ReadingState): Promise<void>;
  delete(contentId: string): Promise<void>;
}

export class StorageReadingStateRepository implements ReadingStateRepository {
  private readonly states;

  constructor(storage: Storage) {
    this.states = storage.collection(STATE_COLLECTION);
  }

  async get(contentId: string): Promise<ReadingState | undefined> {
    const record = await this.states.get(contentId);
    return record ? toState(record) : undefined;
  }

  async save(state: ReadingState): Promise<void> {
    validateState(state);
    await this.states.put(toRecord(state));
  }

  async delete(contentId: string): Promise<void> {
    await this.states.delete(contentId);
  }
}

function toRecord(state: ReadingState): StorageRecord {
  return { id: state.contentId, ...state };
}

function toState(record: StorageRecord): ReadingState {
  validateState(record);
  const { id: _storageId, ...state } = record;
  return state;
}

function validateState(value: unknown): asserts value is ReadingState {
  if (!isReadingState(value)) {
    throw new Error(`Invalid reading state: ${recordId(value)}.`);
  }
}

function isReadingState(value: unknown): value is ReadingState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const position = state.position;
  const validPosition = position === undefined ||
    (isRecord(position) &&
      typeof position.blockId === 'string' &&
      typeof position.offset === 'number' &&
      Number.isInteger(position.offset) &&
      position.offset >= 0);

  return typeof state.contentId === 'string' &&
    typeof state.documentId === 'string' &&
    typeof state.documentVersion === 'number' &&
    Number.isInteger(state.documentVersion) &&
    state.documentVersion > 0 &&
    validPosition &&
    typeof state.read === 'boolean' &&
    typeof state.starred === 'boolean' &&
    typeof state.updatedAt === 'number' &&
    Number.isFinite(state.updatedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function recordId(value: unknown): string {
  if (isRecord(value) && typeof value.id === 'string') return value.id;
  if (isRecord(value) && typeof value.contentId === 'string') return value.contentId;
  return '<unknown>';
}
