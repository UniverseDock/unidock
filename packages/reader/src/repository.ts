import type { Storage, StorageRecord } from '@unidock/storage';
import { DOCUMENT_VERSION, type ReaderBlock, type ReaderDocument } from './document.js';

const DOCUMENTS_COLLECTION = 'reader-documents';

export interface DocumentRepository {
  get(id: string): Promise<ReaderDocument | undefined>;
  getByContentId(contentId: string): Promise<ReaderDocument | undefined>;
  save(document: ReaderDocument): Promise<void>;
  delete(id: string): Promise<void>;
}

export class StorageDocumentRepository implements DocumentRepository {
  private readonly documents;

  constructor(storage: Storage) {
    this.documents = storage.collection(DOCUMENTS_COLLECTION);
  }

  async get(id: string): Promise<ReaderDocument | undefined> {
    const record = await this.documents.get(id);
    return record ? toDocument(record) : undefined;
  }

  async getByContentId(contentId: string): Promise<ReaderDocument | undefined> {
    const records = await this.documents.list({ where: { contentId }, limit: 1 });
    const record = records[0];
    return record ? toDocument(record) : undefined;
  }

  async save(document: ReaderDocument): Promise<void> {
    validateDocument(document);
    await this.documents.put(toRecord(document));
  }

  async delete(id: string): Promise<void> {
    await this.documents.delete(id);
  }
}

function toRecord(document: ReaderDocument): StorageRecord {
  return { ...document };
}

function toDocument(record: StorageRecord): ReaderDocument {
  validateDocument(record);
  return record;
}

function validateDocument(value: unknown): asserts value is ReaderDocument {
  if (!isReaderDocument(value)) {
    throw new Error(`Invalid Reader document: ${recordId(value)}.`);
  }
}

function isReaderDocument(value: unknown): value is ReaderDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return typeof document.id === 'string' &&
    typeof document.contentId === 'string' &&
    document.version === DOCUMENT_VERSION &&
    typeof document.title === 'string' &&
    Array.isArray(document.blocks) &&
    document.blocks.every(isReaderBlock);
}

function isReaderBlock(value: unknown): value is ReaderBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (typeof block.id !== 'string' || typeof block.type !== 'string') return false;

  switch (block.type) {
    case 'heading':
      return (block.level === 1 || block.level === 2 || block.level === 3) && typeof block.text === 'string';
    case 'paragraph':
    case 'quote':
      return typeof block.text === 'string';
    case 'list':
      return typeof block.ordered === 'boolean' &&
        Array.isArray(block.items) &&
        block.items.every((item) => typeof item === 'string');
    case 'code':
      return typeof block.code === 'string' &&
        (block.language === undefined || typeof block.language === 'string');
    case 'image':
      return typeof block.src === 'string' &&
        typeof block.alt === 'string' &&
        (block.caption === undefined || typeof block.caption === 'string');
    case 'divider':
      return true;
    default:
      return false;
  }
}

function recordId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return '<unknown>';
}
