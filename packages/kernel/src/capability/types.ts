/**
 * A capability represents something a plugin can provide.
 *
 * Examples:
 *   content.provider
 *   player
 *   renderer
 *   storage
 *
 * Core code should depend on capabilities instead of concrete plugins.
 */

export interface CapabilityDescriptor {
  /**
   * Globally unique capability identifier.
   *
   * Example:
   *   content.provider
   *   player
   */
  id: string;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Capability API version.
   */
  version: string;

  /**
   * Plugin that provides this capability.
   */
  providerId: string;
}

export interface CapabilityProvider {
  descriptor: CapabilityDescriptor;

  /**
   * Capability implementation.
   *
   * The Kernel does not impose a concrete implementation type.
   * Individual capability contracts define their own API.
   */
  implementation: unknown;
}
