/**
 * Create a UniDock content identifier.
 *
 * The current implementation uses UUID.
 * The storage layer may later introduce deterministic IDs
 * for imported external content.
 */
export function createContentId(): string {
  return crypto.randomUUID();
}
