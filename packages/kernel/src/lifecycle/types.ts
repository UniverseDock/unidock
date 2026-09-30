import type {
  Plugin,
  PluginInfo,
  PluginStatus
} from '../plugin/index.js';

export interface PluginLifecycle {
  plugin: PluginInfo;
  status: PluginStatus;
  implementation?: Plugin;
}

export interface LifecycleTransition {
  from: PluginStatus;
  to: PluginStatus;
}
