import type { Content, ContentRepository } from '@unidock/content';
import type { DocumentRepository, ReaderDocument } from '@unidock/reader';
import { FeedFetcher, type FetchFeedOptions } from './fetcher.js';
import { feedItemToArticle } from './importer.js';
import { feedItemToDocument } from './document-importer.js';
import type { ExtractedArticle } from './article-extractor.js';
import type { Feed, ParseFeedOptions } from './model.js';
import { parseFeed } from './parser.js';

export interface ImportFeedOptions extends ParseFeedOptions, FetchFeedOptions {}

export interface FeedImportResult {
  feed: Feed;
  contents: Content[];
  documents: ReaderDocument[];
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
      await this.contentRepository.save(content);
      const document = await this.createDocument(item, content, options);
      await this.documentRepository.save(document);
      contents.push(content);
      documents.push(document);
    }

    return { feed, contents, documents };
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
