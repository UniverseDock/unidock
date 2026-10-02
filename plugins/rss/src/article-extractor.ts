import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { DocumentInputBlock } from '@unidock/reader';
import { htmlToBlocks } from './document-importer.js';

export interface ExtractedArticle {
  title?: string;
  byline?: string;
  excerpt?: string;
  contentHtml: string;
  blocks: DocumentInputBlock[];
}

export function extractArticle(html: string, url: string): ExtractedArticle | undefined {
  if (!html.trim()) return undefined;
  const { document } = parseHTML(html);
  const article = new Readability(document, { charThreshold: 0 }).parse();
  if (!article?.content?.trim()) return undefined;

  return {
    title: article.title || undefined,
    byline: article.byline ?? undefined,
    excerpt: article.excerpt || undefined,
    contentHtml: article.content,
    blocks: htmlToBlocks(article.content, url)
  };
}
