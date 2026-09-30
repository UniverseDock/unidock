import type {
  Plugin,
  PluginInfo
} from '../plugin/index.js';

import {
  PluginLifecycleManager
} from '../lifecycle/index.js';

import {
  CapabilityRegistry
} from '../capability/index.js';

import {
  PermissionRegistry
} from '../permission/index.js';

import {
  EventBus
} from '../event/index.js';

export interface PluginRuntimeOptions {
  lifecycle: PluginLifecycleManager;
  capabilities: CapabilityRegistry;
  permissions: PermissionRegistry;
  events: EventBus;
}

export class PluginRuntime {
  private readonly lifecycle: PluginLifecycleManager;
  private readonly capabilities: CapabilityRegistry;
  private readonly permissions: PermissionRegistry;
  private readonly events: EventBus;

  constructor(options: PluginRuntimeOptions) {
    this.lifecycle = options.lifecycle;
    this.capabilities = options.capabilities;
    this.permissions = options.permissions;
    this.events = options.events;
  }

  /**
   * Register a plugin with the runtime.
   */
  register(
    info: PluginInfo,
    implementation: Plugin
  ): void {
    this.lifecycle.register(info, implementation);
  }

  /**
   * Install a plugin.
   */
  async install(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle?.implementation) {
      throw new Error(`Plugin implementation not found: ${pluginId}`);
    }

    if (lifecycle.status === 'discovered') {
      await this.lifecycle.transition(pluginId, 'downloaded');
    }

    if (lifecycle.status === 'downloaded') {
      await this.lifecycle.transition(pluginId, 'verified');
    }

    if (lifecycle.status === 'verified') {
      await lifecycle.implementation.install({
        plugin: lifecycle.plugin
      });

      await this.lifecycle.transition(pluginId, 'installed');

      await this.events.emit('plugin.installed', {
        pluginId
      });
    }
  }

  /**
   * Enable a plugin.
   */
  async enable(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle?.implementation) {
      throw new Error(`Plugin implementation not found: ${pluginId}`);
    }

    if (lifecycle.status !== 'installed') {
      throw new Error(
        `Plugin must be installed before enabling: ${pluginId}`
      );
    }

    await this.lifecycle.transition(pluginId, 'enabled');

    await this.events.emit('plugin.enabled', {
      pluginId
    });
  }

  /**
   * Activate a plugin.
   */
  async activate(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle?.implementation) {
      throw new Error(`Plugin implementation not found: ${pluginId}`);
    }

    if (lifecycle.status !== 'enabled') {
      throw new Error(
        `Plugin must be enabled before activation: ${pluginId}`
      );
    }

    await lifecycle.implementation.activate({
      plugin: lifecycle.plugin
    });

    await this.lifecycle.transition(pluginId, 'activated');
    await this.lifecycle.transition(pluginId, 'running');

    await this.events.emit('plugin.activated', {
      pluginId
    });

    await this.events.emit('plugin.running', {
      pluginId
    });
  }

  /**
   * Deactivate a running plugin.
   */
  async deactivate(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle?.implementation) {
      throw new Error(`Plugin implementation not found: ${pluginId}`);
    }

    if (
      lifecycle.status !== 'running' &&
      lifecycle.status !== 'activated'
    ) {
      return;
    }

    await lifecycle.implementation.deactivate();

    this.permissions.revokeAll(pluginId);

    await this.lifecycle.transition(pluginId, 'deactivated');

    await this.events.emit('plugin.deactivated', {
      pluginId
    });
  }

  /**
   * Disable a plugin.
   */
  async disable(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle) {
      throw new Error(`Plugin not registered: ${pluginId}`);
    }

    if (
      lifecycle.status === 'running' ||
      lifecycle.status === 'activated'
    ) {
      await this.deactivate(pluginId);
    }

    if (lifecycle.status === 'deactivated') {
      await this.lifecycle.transition(pluginId, 'disabled');
    }

    if (lifecycle.status === 'enabled') {
      await this.lifecycle.transition(pluginId, 'disabled');
    }

    await this.events.emit('plugin.disabled', {
      pluginId
    });
  }

  /**
   * Uninstall a plugin.
   */
  async uninstall(pluginId: string): Promise<void> {
    const lifecycle = this.lifecycle.get(pluginId);

    if (!lifecycle?.implementation) {
      throw new Error(`Plugin implementation not found: ${pluginId}`);
    }

    if (
      lifecycle.status === 'running' ||
      lifecycle.status === 'activated'
    ) {
      await this.deactivate(pluginId);
    }

    if (lifecycle.status === 'enabled') {
      await this.lifecycle.transition(pluginId, 'disabled');
    }

    if (
      lifecycle.status !== 'disabled' &&
      lifecycle.status !== 'installed'
    ) {
      throw new Error(
        `Plugin cannot be uninstalled from state ${lifecycle.status}: ${pluginId}`
      );
    }

    await lifecycle.implementation.uninstall();

    this.permissions.revokeAll(pluginId);

    const capabilities = this.capabilities.list()
      .filter((capability) => capability.providerId === pluginId);

    for (const capability of capabilities) {
      this.capabilities.unregister(capability.id);
    }

    await this.lifecycle.transition(pluginId, 'uninstalled');

    await this.events.emit('plugin.uninstalled', {
      pluginId
    });

    this.lifecycle.remove(pluginId);
  }
}
