/**
 * UniDock Plugin
 *
 * Plugin is the fundamental extension unit of UniDock.
 */

export type PluginType =
  | 'source'
  | 'processor'
  | 'renderer'
  | 'player'
  | 'storage'
  | 'service'
  | 'integration'
  | 'automation'
  | 'ai'
  | 'ui'
  | 'command'
  | 'transform'
  | 'system';

export type PluginStatus =
  | 'discovered'
  | 'downloaded'
  | 'verified'
  | 'installed'
  | 'enabled'
  | 'activated'
  | 'running'
  | 'deactivated'
  | 'disabled'
  | 'uninstalled';

export interface PluginManifest {
  /**
   * Globally unique plugin identifier.
   *
   * Example:
   * provider.iptv
   * source.rss
   * renderer.epub
   */
  id: string;

  /**
   * Human-readable plugin name.
   */
  name: string;

  /**
   * Semantic version.
   */
  version: string;

  /**
   * UniDock Plugin API version.
   */
  apiVersion: string;

  /**
   * Plugin category.
   */
  type: PluginType;

  /**
   * Plugin entry point.
   */
  entry: string;

  /**
   * Requested permissions.
   */
  permissions: string[];

  /**
   * Capabilities provided by this plugin.
   */
  capabilities: string[];

  /**
   * Optional plugin dependencies.
   */
  dependencies?: Record<string, string>;

  /**
   * Optional metadata.
   */
  description?: string;
  author?: string;
  homepage?: string;
  icon?: string;
}

export interface PluginInfo {
  manifest: PluginManifest;
  status: PluginStatus;
}

export interface InstallContext {
  plugin: PluginInfo;
}

export interface PluginContext {
  plugin: PluginInfo;
}

export interface Plugin {
  /**
   * Called when the plugin is installed.
   */
  install(context: InstallContext): Promise<void>;

  /**
   * Called when the plugin becomes active.
   */
  activate(context: PluginContext): Promise<void>;

  /**
   * Called before the plugin is disabled.
   */
  deactivate(): Promise<void>;

  /**
   * Called when the plugin is removed.
   */
  uninstall(): Promise<void>;
}
