import type { Content, ContentRepository } from '@unidock/content';
import type { FeedItem } from './model.js';

export function feedItemToArticle(item: FeedItem): Content {
  return {
    id: item.id,
    type: 'article',
    title: item.title,
    description: item.description,
    author: item.author,
    tags: item.categories,
    sourceId: item.feedId,
    createdAt: item.publishedAt ?? 0,
    updatedAt: item.publishedAt ?? 0
  };
}

export async function importFeedItems(
  repository: ContentRepository,
  items: FeedItem[]
): Promise<Content[]> {
  const imported: Content[] = [];
  for (const item of items) {
    const content = feedItemToArticle(item);
    const existing = await repository.get(content.id);
    const next = existing
      ? { ...content, createdAt: existing.createdAt, updatedAt: Math.max(existing.updatedAt, content.updatedAt) }
      : content;
    await repository.save(next);
    imported.push(next);
  }
  return imported;
}
