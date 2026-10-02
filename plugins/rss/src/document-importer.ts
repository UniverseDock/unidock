import { parseDocument } from 'htmlparser2';
import type { Content } from '@unidock/content';
import {
  createArticleDocument,
  type DocumentInputBlock,
  type DocumentRepository,
  type ReaderDocument
} from '@unidock/reader';
import type { FeedItem } from './model.js';

export function feedItemToDocument(item: FeedItem, content: Content): ReaderDocument {
  const html = item.content ?? item.description ?? '';
  return createArticleDocument(content, {
    blocks: htmlToBlocks(html, item.url)
  });
}

export async function importFeedItemDocument(
  item: FeedItem,
  content: Content,
  repository: DocumentRepository
): Promise<ReaderDocument> {
  const document = feedItemToDocument(item, content);
  await repository.save(document);
  return document;
}

export function htmlToBlocks(html: string, baseUrl?: string): DocumentInputBlock[] {
  const root = parseDocument(html);
  const blocks: DocumentInputBlock[] = [];
  for (const node of root.children) appendBlock(node, blocks, baseUrl);
  return blocks;
}

function appendBlock(node: HtmlNode, blocks: DocumentInputBlock[], baseUrl?: string): void {
  if (isText(node)) {
    const text = cleanText(node.data);
    if (text) blocks.push({ type: 'paragraph', text });
    return;
  }
  if (!isTag(node)) return;

  const name = node.name.toLowerCase();
  if (/^h[1-3]$/.test(name)) {
    const text = cleanText(textContent(node));
    if (text) blocks.push({ type: 'heading', level: Number(name[1]) as 1 | 2 | 3, text });
    return;
  }
  if (name === 'p' || name === 'article' || name === 'section' || name === 'div') {
    const text = cleanText(textContent(node));
    if (text) blocks.push({ type: 'paragraph', text });
    return;
  }
  if (name === 'ul' || name === 'ol') {
    const items = node.children
      .filter(isTag)
      .filter((child) => child.name.toLowerCase() === 'li')
      .map((child) => cleanText(textContent(child)))
      .filter(Boolean);
    if (items.length > 0) blocks.push({ type: 'list', ordered: name === 'ol', items });
    return;
  }
  if (name === 'blockquote') {
    const text = cleanText(textContent(node));
    if (text) blocks.push({ type: 'quote', text });
    return;
  }
  if (name === 'pre') {
    const code = cleanText(textContent(node));
    if (code) blocks.push({ type: 'code', code });
    return;
  }
  if (name === 'img') {
    const src = safeUrl(node.attribs.src, baseUrl);
    const alt = node.attribs.alt ?? '';
    if (src) blocks.push({ type: 'image', src, alt });
    return;
  }
  if (name === 'hr') {
    blocks.push({ type: 'divider' });
    return;
  }
  for (const child of node.children) appendBlock(child, blocks, baseUrl);
}

function textContent(node: HtmlNode): string {
  if (isText(node)) return node.data;
  if (!isTag(node)) return '';
  return node.children.map(textContent).join('');
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function safeUrl(value: string | undefined, baseUrl?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

interface TextNode {
  type: 'text';
  data: string;
}

interface TagNode {
  type: 'tag';
  name: string;
  attribs: Record<string, string>;
  children: HtmlNode[];
}

type HtmlNode = TextNode | TagNode | { type: string };

function isTag(node: HtmlNode): node is TagNode {
  return node.type === 'tag' &&
    typeof (node as Partial<TagNode>).name === 'string' &&
    Boolean((node as Partial<TagNode>).attribs) &&
    Array.isArray((node as Partial<TagNode>).children);
}

function isText(node: HtmlNode): node is TextNode {
  return node.type === 'text' && typeof (node as Partial<TextNode>).data === 'string';
}
