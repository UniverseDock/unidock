import type { Storage, StorageRecord } from '@unidock/storage';
import type { Content } from '../model/types.js';
import type { ContentQuery, ContentRepository } from './repository.js';

const CONTENTS_COLLECTION = 'contents';
const CONTENT_TYPES = new Set<Content['type']>([
  'book',
  'article',
  'rss',
  'live',
  'video',
  'audio',
  'comic',
  'document'
]);

/** ContentRepository backed by the platform-neutral Storage API. */
export class StorageContentRepository implements ContentRepository {
  private readonly contents;

  constructor(storage: Storage) {
    this.contents = storage.collection(CONTENTS_COLLECTION);
  }

  async get(id: string): Promise<Content | undefined> {
    const record = await this.contents.get(id);
    return record ? toContent(record) : undefined;
  }

  async save(content: Content): Promise<void> {
    validateContent(content);
    await this.contents.put({ ...content } satisfies StorageRecord);
  }

  async delete(id: string): Promise<void> {
    await this.contents.delete(id);
  }

  async list(query: ContentQuery = {}): Promise<Content[]> {
    const where: Record<string, unknown> = {};
    if (query.type !== undefined) where.type = query.type;
    if (query.sourceId !== undefined) where.sourceId = query.sourceId;
    const records = await this.contents.list({ where });
    const filtered = records
      .map((record) => toContent(record))
      .filter((content) => !query.tags || query.tags.every((tag) => content.tags?.includes(tag)));
    const offset = Math.max(0, query.offset ?? 0);
    const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit);
    return filtered.slice(offset, end);
  }
}

function toContent(record: StorageRecord): Content {
  if (!isContent(record)) {
    throw new Error(`Invalid Content record: ${record.id ?? '<unknown>'}.`);
  }
  return record;
}

function validateContent(value: unknown): asserts value is Content {
  if (!isContent(value)) {
    throw new Error(`Invalid Content record: ${recordId(value)}.`);
  }
}

function isContent(value: unknown): value is Content {
  if (!value || typeof value !== 'object') return false;
  const content = value as Record<string, unknown>;
  if (
    typeof content.id !== 'string' ||
    typeof content.title !== 'string' ||
    !CONTENT_TYPES.has(content.type as Content['type']) ||
    typeof content.createdAt !== 'number' ||
    !Number.isFinite(content.createdAt) ||
    typeof content.updatedAt !== 'number' ||
    !Number.isFinite(content.updatedAt)
  ) {
    return false;
  }
  return content.tags === undefined ||
    (Array.isArray(content.tags) && content.tags.every((tag) => typeof tag === 'string'));
}

function recordId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return '<unknown>';
}
