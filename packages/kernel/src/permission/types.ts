/**
 * Permissions available to UniDock plugins.
 *
 * Permissions describe what a plugin is allowed to access.
 */

export type Permission =
  | 'content.read'
  | 'content.write'
  | 'storage.read'
  | 'storage.write'
  | 'network.request'
  | 'network.proxy'
  | 'reader.open'
  | 'reader.selection'
  | 'player.play'
  | 'notification'
  | 'clipboard.read'
  | 'clipboard.write'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'user.profile'
  | 'account'
  | 'automation';

export interface PermissionRequest {
  pluginId: string;
  permissions: Permission[];
}

export interface PermissionGrant {
  pluginId: string;
  permissions: Permission[];
}
