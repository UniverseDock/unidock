import type { Content, ContentRepository } from '@unidock/content';
import type { DocumentInputBlock, DocumentRepository, ReaderDocument } from '@unidock/reader';
import { FeedFetcher, type FetchFeedOptions } from './fetcher.js';
import { feedItemToArticle } from './importer.js';
import { feedItemToDocument } from './document-importer.js';
import type { Feed, ParseFeedOptions } from './model.js';
import { parseFeed } from './parser.js';

export interface ImportFeedOptions extends ParseFeedOptions, FetchFeedOptions {}

export interface FeedImportResult {
  feed: Feed;
  contents: Content[];
  documents: ReaderDocument[];
  added: number;
  updated: number;
  unchanged: number;
}

export interface ExtractedArticle {
  blocks: DocumentInputBlock[];
}

export type ArticleExtractor = (html: string, url: string) => ExtractedArticle | undefined;

export class FeedImportService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly fetcher: FeedFetcher = new FeedFetcher(),
    private readonly articleExtractor?: ArticleExtractor
  ) {}

  async importFromUrl(options: ImportFeedOptions): Promise<FeedImportResult> {
    const xml = await this.fetcher.fetchXml(options.feedUrl, options);
    const feed = parseFeed(xml, options);
    const contents: Content[] = [];
    const documents: ReaderDocument[] = [];
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of feed.items) {
      const nextContent = feedItemToArticle(item);
      const existingContent = await this.contentRepository.get(nextContent.id);
      const content = existingContent
        ? {
            ...nextContent,
            createdAt: existingContent.createdAt,
            updatedAt: Math.max(existingContent.updatedAt, nextContent.updatedAt)
          }
        : nextContent;
      if (!existingContent) {
        added += 1;
      } else if (nextContent.updatedAt > existingContent.updatedAt) {
        updated += 1;
      } else {
        unchanged += 1;
      }
      await this.contentRepository.save(content);
      const document = await this.createDocument(item, content, options);
      await this.documentRepository.save(document);
      contents.push(content);
      documents.push(document);
    }

    return { feed, contents, documents, added, updated, unchanged };
  }

  private async createDocument(
    item: Feed['items'][number],
    content: Content,
    options: ImportFeedOptions
  ): Promise<ReaderDocument> {
    if (item.content?.trim()) return feedItemToDocument(item, content);

    const summaryDocument = feedItemToDocument(item, content);
    if (!item.url || !this.articleExtractor) return summaryDocument;

    try {
      const html = await this.fetcher.fetchHtml(item.url, options);
      const article = this.articleExtractor(html, item.url);
      if (!article || article.blocks.length === 0) return summaryDocument;
      return {
        ...summaryDocument,
        blocks: article.blocks.map((block, index) => ({
          ...block,
          id: `block:${index + 1}`
        }))
      };
    } catch {
      return summaryDocument;
    }
  }
}
