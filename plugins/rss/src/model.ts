export type FeedFormat = 'atom' | 'rss2';

export interface Feed {
  id: string;
  format: FeedFormat;
  title: string;
  url: string;
  siteUrl?: string;
  description?: string;
  items: FeedItem[];
}

export interface FeedItem {
  id: string;
  feedId: string;
  guid: string;
  title: string;
  url?: string;
  description?: string;
  content?: string;
  author?: string;
  publishedAt?: number;
  imageUrl?: string;
  categories: string[];
}

export interface ParseFeedOptions {
  feedUrl: string;
  feedId?: string;
}
