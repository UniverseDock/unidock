/**
 * UniDock Content Domain
 *
 * Content is the common metadata model shared by different
 * content types such as books, articles, videos and live channels.
 */

export type ContentType =
  | 'book'
  | 'article'
  | 'rss'
  | 'live'
  | 'video'
  | 'audio'
  | 'comic'
  | 'document';

export interface Content {
  /**
   * Globally unique content identifier.
   */
  id: string;

  /**
   * Content type.
   */
  type: ContentType;

  /**
   * Display title.
   */
  title: string;

  /**
   * Optional subtitle.
   */
  subtitle?: string;

  /**
   * Optional description.
   */
  description?: string;

  /**
   * Cover or thumbnail URL.
   */
  cover?: string;

  /**
   * Primary author or creator.
   */
  author?: string;

  /**
   * Content tags.
   */
  tags?: string[];

  /**
   * Source that provided this content.
   */
  sourceId?: string;

  /**
   * Creation timestamp.
   */
  createdAt: number;

  /**
   * Last update timestamp.
   */
  updatedAt: number;
}
