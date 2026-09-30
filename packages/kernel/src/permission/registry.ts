import type {
  Permission,
  PermissionGrant,
  PermissionRequest
} from './types.js';

export class PermissionRegistry {
  private readonly grants = new Map<string, Set<Permission>>();

  /**
   * Grant permissions to a plugin.
   */
  grant(grant: PermissionGrant): void {
    const existing = this.grants.get(grant.pluginId) ?? new Set<Permission>();

    for (const permission of grant.permissions) {
      existing.add(permission);
    }

    this.grants.set(grant.pluginId, existing);
  }

  /**
   * Revoke specific permissions from a plugin.
   */
  revoke(pluginId: string, permissions: Permission[]): void {
    const existing = this.grants.get(pluginId);

    if (!existing) {
      return;
    }

    for (const permission of permissions) {
      existing.delete(permission);
    }

    if (existing.size === 0) {
      this.grants.delete(pluginId);
    }
  }

  /**
   * Revoke all permissions from a plugin.
   */
  revokeAll(pluginId: string): void {
    this.grants.delete(pluginId);
  }

  /**
   * Check whether a plugin has a permission.
   */
  has(pluginId: string, permission: Permission): boolean {
    return this.grants.get(pluginId)?.has(permission) ?? false;
  }

  /**
   * Check whether a plugin has all requested permissions.
   */
  hasAll(request: PermissionRequest): boolean {
    return request.permissions.every((permission) =>
      this.has(request.pluginId, permission)
    );
  }

  /**
   * Get all granted permissions for a plugin.
   */
  list(pluginId: string): Permission[] {
    return Array.from(this.grants.get(pluginId) ?? []);
  }
}
