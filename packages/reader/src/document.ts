import type { Content } from '@unidock/content';

export const DOCUMENT_VERSION = 1;

export type ReaderBlock = 
  | CodeBlock
  | DividerBlock
  | HeadingBlock
  | ImageBlock
  | ListBlock
  | ParagraphBlock
  | QuoteBlock;

export interface BaseBlock {
  id: string;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  text: string;
  cite?: string;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  code: string;
  language?: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface ReaderDocument {
  id: string;
  contentId: string;
  version: typeof DOCUMENT_VERSION;
  title: string;
  blocks: ReaderBlock[];
}

export type DocumentInputBlock =
  | Omit<CodeBlock, 'id'>
  | Omit<DividerBlock, 'id'>
  | Omit<HeadingBlock, 'id'>
  | Omit<ImageBlock, 'id'>
  | Omit<ListBlock, 'id'>
  | Omit<ParagraphBlock, 'id'>
  | Omit<QuoteBlock, 'id'>;

export interface ArticleDocumentInput {
  blocks?: DocumentInputBlock[];
}

export function createArticleDocument(
  content: Content,
  input: ArticleDocumentInput = {}
): ReaderDocument {
  const blocks = input.blocks ?? [];
  return {
    id: `document:${content.id}`,
    contentId: content.id,
    version: DOCUMENT_VERSION,
    title: content.title,
    blocks: blocks.map((block, index) => normalizeBlock(block, index))
  };
}

function normalizeBlock(block: DocumentInputBlock, index: number): ReaderBlock {
  if (!isDocumentInputBlock(block)) {
    throw new Error(`Invalid Reader block at index ${index}.`);
  }
  return {
    ...block,
    id: `block:${index + 1}`
  } as ReaderBlock;
}

function isDocumentInputBlock(value: unknown): value is DocumentInputBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (typeof block.type !== 'string') return false;

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
      return typeof block.src === 'string' && typeof block.alt === 'string' &&
        (block.caption === undefined || typeof block.caption === 'string');
    case 'divider':
      return true;
    default:
      return false;
  }
}
