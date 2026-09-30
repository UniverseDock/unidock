import type {
  Plugin,
  PluginInfo,
  PluginStatus
} from '../plugin/index.js';

import type {
  PluginLifecycle
} from './types.js';

const VALID_TRANSITIONS: Record<PluginStatus, PluginStatus[]> = {
  discovered: ['downloaded', 'uninstalled'],
  downloaded: ['verified', 'uninstalled'],
  verified: ['installed', 'uninstalled'],
  installed: ['enabled', 'uninstalled'],
  enabled: ['activated', 'disabled', 'uninstalled'],
  activated: ['running', 'deactivated', 'disabled'],
  running: ['deactivated', 'disabled'],
  deactivated: ['activated', 'disabled', 'uninstalled'],
  disabled: ['enabled', 'uninstalled'],
  uninstalled: []
};

export class PluginLifecycleManager {
  private readonly plugins = new Map<string, PluginLifecycle>();

  /**
   * Register a discovered plugin.
   */
  register(
    info: PluginInfo,
    implementation?: Plugin
  ): void {
    if (this.plugins.has(info.manifest.id)) {
      throw new Error(
        `Plugin already registered: ${info.manifest.id}`
      );
    }

    this.plugins.set(info.manifest.id, {
      plugin: info,
      status: info.status,
      implementation
    });
  }

  /**
   * Get plugin lifecycle state.
   */
  get(pluginId: string): PluginLifecycle | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * List all registered plugins.
   */
  list(): PluginLifecycle[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Change plugin state.
   */
  async transition(
    pluginId: string,
    target: PluginStatus
  ): Promise<void> {
    const lifecycle = this.plugins.get(pluginId);

    if (!lifecycle) {
      throw new Error(`Plugin not registered: ${pluginId}`);
    }

    const current = lifecycle.status;

    if (current === target) {
      return;
    }

    const allowed = VALID_TRANSITIONS[current];

    if (!allowed.includes(target)) {
      throw new Error(
        `Invalid plugin lifecycle transition: ${current} -> ${target}`
      );
    }

    lifecycle.status = target;
    lifecycle.plugin.status = target;
  }

  /**
   * Remove a plugin from the lifecycle registry.
   *
   * The caller should ensure the plugin has already been
   * deactivated before uninstalling it.
   */
  remove(pluginId: string): void {
    const lifecycle = this.plugins.get(pluginId);

    if (!lifecycle) {
      return;
    }

    if (lifecycle.status !== 'uninstalled') {
      throw new Error(
        `Plugin must be uninstalled before removal: ${pluginId}`
      );
    }

    this.plugins.delete(pluginId);
  }
}
