import type { Content } from '../model/types.js';

export interface ContentQuery {
  type?: string;
  sourceId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ContentRepository {
  get(id: string): Promise<Content | undefined>;

  save(content: Content): Promise<void>;

  delete(id: string): Promise<void>;

  list(query?: ContentQuery): Promise<Content[]>;
}
