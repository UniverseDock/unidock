import type { Content, ContentRepository } from '@unidock/content';
import type { DocumentRepository, ReaderDocument } from '@unidock/reader';
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
}

export class FeedImportService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly fetcher: FeedFetcher = new FeedFetcher()
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
      const document = feedItemToDocument(item, content);
      await this.documentRepository.save(document);
      contents.push(content);
      documents.push(document);
    }

    return { feed, contents, documents };
  }
}
