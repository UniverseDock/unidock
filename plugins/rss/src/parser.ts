import { XMLParser } from 'fast-xml-parser';
import type { Feed, FeedItem, ParseFeedOptions } from './model.js';

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

export function parseFeed(xml: string, options: ParseFeedOptions): Feed {
  if (!xml.trim()) throw new Error('Feed XML must not be empty.');
  const parsed = parser.parse(xml) as unknown;
  if (!isRecord(parsed)) throw new Error('Feed XML has no root element.');

  if (isRecord(parsed.rss) && isRecord(parsed.rss.channel)) {
    return parseRss(parsed.rss.channel, options);
  }
  if (isRecord(parsed.feed)) {
    return parseAtom(parsed.feed, options);
  }
  throw new Error('Unsupported feed format. Expected RSS 2.0 or Atom.');
}

function parseRss(channel: Record<string, unknown>, options: ParseFeedOptions): Feed {
  const feedId = options.feedId ?? options.feedUrl;
  return {
    id: feedId,
    format: 'rss2',
    title: text(channel.title) ?? 'Untitled feed',
    url: options.feedUrl,
    siteUrl: resolveUrl(text(channel.link), options.feedUrl),
    description: text(channel.description),
    items: toArray(channel.item).map((item, index) => parseRssItem(item, feedId, options.feedUrl, index))
  };
}

function parseRssItem(value: unknown, feedId: string, feedUrl: string, index: number): FeedItem {
  const item = asRecord(value, `RSS item ${index}`);
  if (!item) throw new Error(`RSS item ${index} is malformed.`);
  const url = resolveUrl(text(item.link), feedUrl);
  const guid = text(item.guid) ?? url ?? `${feedId}#item-${index + 1}`;
  return {
    id: `${feedId}::${guid}`,
    feedId,
    guid,
    title: text(item.title) ?? `Untitled item ${index + 1}`,
    url,
    description: text(item.description),
    content: text(item['content:encoded']),
    author: text(item.author) ?? text(item['dc:creator']),
    publishedAt: parseDate(text(item.pubDate)),
    imageUrl: resolveUrl(extractRssImage(item), feedUrl),
    categories: toArray(item.category).map((category) => text(category)).filter(isString)
  };
}

function parseAtom(feed: Record<string, unknown>, options: ParseFeedOptions): Feed {
  const feedId = options.feedId ?? options.feedUrl;
  return {
    id: feedId,
    format: 'atom',
    title: text(feed.title) ?? 'Untitled feed',
    url: options.feedUrl,
    siteUrl: resolveUrl(extractAtomLink(feed.link, 'alternate'), options.feedUrl),
    description: text(feed.subtitle),
    items: toArray(feed.entry).map((entry, index) => parseAtomItem(entry, feedId, options.feedUrl, index))
  };
}

function parseAtomItem(value: unknown, feedId: string, feedUrl: string, index: number): FeedItem {
  const item = asRecord(value, `Atom entry ${index}`);
  if (!item) throw new Error(`Atom entry ${index} is malformed.`);
  const url = resolveUrl(extractAtomLink(item.link, 'alternate'), feedUrl);
  const guid = text(item.id) ?? url ?? `${feedId}#entry-${index + 1}`;
  return {
    id: `${feedId}::${guid}`,
    feedId,
    guid,
    title: text(item.title) ?? `Untitled entry ${index + 1}`,
    url,
    description: text(item.summary),
    content: text(item.content),
    author: text(asRecord(item.author, 'Atom author', false)?.name),
    publishedAt: parseDate(text(item.published) ?? text(item.updated)),
    imageUrl: resolveUrl(extractAtomLink(item.link, 'enclosure'), feedUrl),
    categories: toArray(item.category)
      .map((category) => text(asRecord(category, 'Atom category', false)?.['@_term']) ?? text(category))
      .filter(isString)
  };
}

function extractRssImage(item: Record<string, unknown>): string | undefined {
  const enclosure = asRecord(item.enclosure, 'RSS enclosure', false);
  return text(enclosure?.['@_url']) ?? text(asRecord(item['media:content'], 'RSS media content', false)?.['@_url']);
}

function extractAtomLink(value: unknown, relation: string): string | undefined {
  for (const link of toArray(value)) {
    const record = asRecord(link, 'Atom link', false);
    if (record && (text(record['@_rel']) ?? 'alternate') === relation) return text(record['@_href']);
  }
  return undefined;
}

function resolveUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.__cdata === 'string') return value.__cdata;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function toArray(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown, label: string, required = true): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  if (!required) return undefined;
  throw new Error(`${label} is malformed.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
