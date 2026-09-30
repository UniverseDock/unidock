import type {
  CapabilityDescriptor,
  CapabilityProvider
} from './types.js';

/**
 * Registry of capabilities currently available in the UniDock runtime.
 *
 * The registry intentionally knows about capabilities, not business
 * implementations such as IPTV, RSS or EPUB.
 */
export class CapabilityRegistry {
  private readonly providers = new Map<string, CapabilityProvider>();

  /**
   * Register a capability provider.
   */
  register(provider: CapabilityProvider): void {
    const { id } = provider.descriptor;

    if (this.providers.has(id)) {
      throw new Error(`Capability already registered: ${id}`);
    }

    this.providers.set(id, provider);
  }

  /**
   * Remove a capability provider.
   */
  unregister(capabilityId: string): void {
    this.providers.delete(capabilityId);
  }

  /**
   * Check whether a capability exists.
   */
  has(capabilityId: string): boolean {
    return this.providers.has(capabilityId);
  }

  /**
   * Get a capability provider.
   */
  get(capabilityId: string): CapabilityProvider | undefined {
    return this.providers.get(capabilityId);
  }

  /**
   * Get a capability implementation.
   */
  resolve<T = unknown>(capabilityId: string): T | undefined {
    return this.providers.get(capabilityId)?.implementation as T | undefined;
  }

  /**
   * List all registered capabilities.
   */
  list(): CapabilityDescriptor[] {
    return Array.from(this.providers.values())
      .map((provider) => provider.descriptor);
  }
}
