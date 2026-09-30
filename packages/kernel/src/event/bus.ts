import type {
  EventHandler,
  EventSubscription
} from './types.js';

export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to an event.
   */
  on<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): EventSubscription {
    let handlers = this.handlers.get(event);

    if (!handlers) {
      handlers = new Set<EventHandler>();
      this.handlers.set(event, handlers);
    }

    handlers.add(handler as EventHandler);

    return {
      event,
      unsubscribe: () => {
        this.off(event, handler);
      }
    };
  }

  /**
   * Subscribe to an event only once.
   */
  once<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): EventSubscription {
    let subscription: EventSubscription;

    const onceHandler: EventHandler<T> = async (payload) => {
      subscription.unsubscribe();
      await handler(payload);
    };

    subscription = this.on(event, onceHandler);

    return subscription;
  }

  /**
   * Remove an event handler.
   */
  off<T = unknown>(
    event: string,
    handler: EventHandler<T>
  ): void {
    const handlers = this.handlers.get(event);

    if (!handlers) {
      return;
    }

    handlers.delete(handler as EventHandler);

    if (handlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Emit an event.
   */
  async emit<T = unknown>(
    event: string,
    payload: T
  ): Promise<void> {
    const handlers = this.handlers.get(event);

    if (!handlers || handlers.size === 0) {
      return;
    }

    const tasks = Array.from(handlers)
      .map((handler) => handler(payload));

    await Promise.all(tasks);
  }

  /**
   * Remove all listeners.
   */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      return;
    }

    this.handlers.clear();
  }

  /**
   * Check whether an event has listeners.
   */
  has(event: string): boolean {
    const handlers = this.handlers.get(event);

    return !!handlers && handlers.size > 0;
  }
}
