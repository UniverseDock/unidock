import type { Content } from '@unidock/content';
import type { ReadingPosition } from '@unidock/reader';
import type { StorageRecord } from '@unidock/storage';

export interface FeedSubscription extends StorageRecord {
  url: string;
  title: string;
  updatedAt: number;
}

export interface BackupDocument extends StorageRecord {
  contentId: string;
  version: number;
  title: string;
  blocks: unknown[];
}

export interface BackupState extends StorageRecord {
  contentId: string;
  documentId: string;
  documentVersion: number;
  read: boolean;
  starred: boolean;
  updatedAt: number;
  position?: ReadingPosition;
}

export interface BackupPayload {
  format: 'unidock-backup';
  version: 1;
  exportedAt: string;
  contents: Content[];
  documents: BackupDocument[];
  states: BackupState[];
  feeds: FeedSubscription[];
}

export type BackupParseErrorCode =
  | 'invalid-json'
  | 'invalid-envelope'
  | 'missing-version'
  | 'invalid-version'
  | 'unsupported-version'
  | 'invalid-payload';

export class BackupParseError extends Error {
  constructor(
    readonly code: BackupParseErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'BackupParseError';
  }
}

export function createBackupPayload(
  contents: Content[],
  documents: BackupDocument[],
  states: BackupState[],
  feeds: FeedSubscription[],
  exportedAt = new Date().toISOString()
): BackupPayload {
  return {
    format: 'unidock-backup',
    version: 1,
    exportedAt,
    contents,
    documents,
    states,
    feeds
  };
}

export function parseBackup(text: string): BackupPayload {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupParseError('invalid-json', '备份文件不是有效的 JSON。');
  }
  if (!isRecord(value) || value.format !== 'unidock-backup') {
    throw new BackupParseError('invalid-envelope', '不是有效的 UniDock 备份文件封套。');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'version')) {
    throw new BackupParseError('missing-version', '备份文件缺少版本号。');
  }
  if (!Number.isInteger(value.version) || (value.version as number) < 0) {
    throw new BackupParseError('invalid-version', '备份文件的版本号无效。');
  }
  if (value.version !== 1) {
    throw new BackupParseError(
      'unsupported-version',
      `备份文件版本 ${String(value.version)} 暂不受支持，请使用 Backup v1 文件。`
    );
  }
  const contents = arrayField(value, 'contents');
  const documents = arrayField(value, 'documents');
  const states = arrayField(value, 'states');
  const feeds = arrayField(value, 'feeds');
  if (!contents.every(isContentBackup) ||
      !documents.every(isDocumentBackup) ||
      !states.every(isStateBackup) ||
      !feeds.every(isFeedSubscription) ||
      !isIsoDate(value.exportedAt) ||
      !hasConsistentIds(contents, documents, states, feeds)) {
    throw new BackupParseError('invalid-payload', '备份文件包含无效数据。');
  }
  return {
    format: 'unidock-backup',
    version: 1,
    exportedAt: value.exportedAt,
    contents,
    documents,
    states,
    feeds
  };
}

function hasConsistentIds(
  contents: Content[],
  documents: BackupDocument[],
  states: BackupState[],
  feeds: FeedSubscription[]
): boolean {
  const contentIds = uniqueIds(contents.map((content) => content.id));
  const documentIds = uniqueIds(documents.map((document) => document.id));
  const feedIds = uniqueIds(feeds.map((feed) => feed.id));
  if (!contentIds || !documentIds || !feedIds) return false;

  const contentSet = new Set(contents.map((content) => content.id));
  const documentSet = new Set(documents.map((document) => document.id));
  return documents.every((document) =>
      document.id === `document:${document.contentId}` &&
      contentSet.has(document.contentId)
    ) &&
    states.every((state) =>
      state.id === state.contentId &&
      contentSet.has(state.contentId) &&
      documentSet.has(state.documentId)
    ) &&
    feeds.every((feed) => feed.id === `feed:${feed.url}`);
}

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function arrayField(value: Record<string, unknown>, key: string): unknown[] {
  const field = value[key];
  if (!Array.isArray(field)) throw new Error(`备份缺少 ${key} 数组。`);
  return field;
}

function isContentBackup(value: unknown): value is Content {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    ['book', 'article', 'rss', 'live', 'video', 'audio', 'comic', 'document'].includes(value.type as string) &&
    typeof value.title === 'string' &&
    (value.subtitle === undefined || typeof value.subtitle === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.cover === undefined || typeof value.cover === 'string') &&
    (value.author === undefined || typeof value.author === 'string') &&
    (value.tags === undefined || Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string')) &&
    (value.sourceId === undefined || typeof value.sourceId === 'string') &&
    finiteNumber(value.createdAt) &&
    finiteNumber(value.updatedAt);
}

function isDocumentBackup(value: unknown): value is BackupDocument {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.contentId === 'string' &&
    value.version === 1 &&
    typeof value.title === 'string' &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isReaderBlock);
}

function isStateBackup(value: unknown): value is BackupState {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.contentId === 'string' &&
    typeof value.documentId === 'string' &&
    Number.isInteger(value.documentVersion) &&
    (value.documentVersion as number) > 0 &&
    (value.position === undefined || isReadingPosition(value.position)) &&
    typeof value.read === 'boolean' &&
    typeof value.starred === 'boolean' &&
    finiteNumber(value.updatedAt);
}

function isFeedSubscription(value: unknown): value is FeedSubscription {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.url === 'string' &&
    isHttpUrl(value.url) &&
    typeof value.title === 'string' &&
    finiteNumber(value.updatedAt);
}

function isReaderBlock(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'heading':
      return (value.level === 1 || value.level === 2 || value.level === 3) && typeof value.text === 'string';
    case 'paragraph':
    case 'quote':
      return typeof value.text === 'string' &&
        (value.cite === undefined || typeof value.cite === 'string');
    case 'list':
      return typeof value.ordered === 'boolean' &&
        Array.isArray(value.items) &&
        value.items.every((item) => typeof item === 'string');
    case 'code':
      return typeof value.code === 'string' &&
        (value.language === undefined || typeof value.language === 'string');
    case 'image':
      return typeof value.src === 'string' &&
        isHttpUrl(value.src) &&
        typeof value.alt === 'string' &&
        (value.caption === undefined || typeof value.caption === 'string');
    case 'divider':
      return true;
    default:
      return false;
  }
}

function isReadingPosition(value: unknown): value is ReadingPosition {
  return isRecord(value) &&
    typeof value.blockId === 'string' &&
    Number.isInteger(value.offset) &&
    (value.offset as number) >= 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
