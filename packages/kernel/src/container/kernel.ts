import {
  CapabilityRegistry
} from '../capability/index.js';

import {
  EventBus
} from '../event/index.js';

import {
  PluginLifecycleManager
} from '../lifecycle/index.js';

import {
  PermissionRegistry
} from '../permission/index.js';

import {
  PluginRuntime
} from '../runtime/index.js';

import {
  PluginContextFactory,
  type PluginContextDependencies
} from '../context/index.js';

export interface KernelDependencies
  extends PluginContextDependencies {}

export class Kernel {
  readonly capabilities: CapabilityRegistry;

  readonly permissions: PermissionRegistry;

  readonly events: EventBus;

  readonly lifecycle: PluginLifecycleManager;

  readonly context: PluginContextFactory;

  readonly runtime: PluginRuntime;

  constructor(
    dependencies: KernelDependencies
  ) {
    this.capabilities = new CapabilityRegistry();

    this.permissions = new PermissionRegistry();

    this.events = new EventBus();

    this.lifecycle = new PluginLifecycleManager();

    this.context = new PluginContextFactory({
      ...dependencies,
      events: this.events
    });

    this.runtime = new PluginRuntime({
      lifecycle: this.lifecycle,
      capabilities: this.capabilities,
      permissions: this.permissions,
      events: this.events,
      context: this.context
    });
  }
}
