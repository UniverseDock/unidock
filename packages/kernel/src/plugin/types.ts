import type { PluginContext } from '../context/types.js';

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
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  type: PluginType;
  entry: string;
  permissions: string[];
  capabilities: string[];
  dependencies?: Record<string, string>;
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

export interface Plugin {
  install(context: InstallContext): Promise<void>;
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  uninstall(): Promise<void>;
}
