import type {
  PluginContext,
  StorageAPI,
  NetworkAPI,
  ContentAPI,
  ReaderAPI,
  PlayerAPI,
  UIAPI,
  NotificationAPI,
  SettingsAPI
} from './types.js';

import type { PluginInfo } from '../plugin/index.js';
import type { EventBus } from '../event/index.js';

export interface PluginContextDependencies {
  storage: StorageAPI;
  network: NetworkAPI;
  content: ContentAPI;
  reader: ReaderAPI;
  player: PlayerAPI;
  ui: UIAPI;
  notification: NotificationAPI;
  settings: SettingsAPI;
  events: EventBus;
}

export class PluginContextFactory {
  constructor(
    private readonly dependencies: PluginContextDependencies
  ) {}

  create(plugin: PluginInfo): PluginContext {
    return {
      plugin,
      storage: this.dependencies.storage,
      network: this.dependencies.network,
      content: this.dependencies.content,
      reader: this.dependencies.reader,
      player: this.dependencies.player,
      ui: this.dependencies.ui,
      notification: this.dependencies.notification,
      settings: this.dependencies.settings,
      events: this.dependencies.events
    };
  }
}
