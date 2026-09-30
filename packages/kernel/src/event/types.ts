/**
 * UniDock Event System
 *
 * Plugins communicate through events instead of directly depending
 * on other plugins.
 */

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventSubscription {
  event: string;
  unsubscribe(): void;
}
