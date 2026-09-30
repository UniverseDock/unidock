import type { EventBus } from '../event/index.js';
import type { PluginInfo } from '../plugin/index.js';

export interface StorageAPI {
  get<T = unknown>(key: string): Promise<T | undefined>;

  set<T = unknown>(
    key: string,
    value: T
  ): Promise<void>;

  delete(key: string): Promise<void>;
}

export interface NetworkAPI {
  get<T = unknown>(
    url: string,
    options?: RequestInit
  ): Promise<T>;

  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T>;
}

export interface ContentAPI {
  get<T = unknown>(
    id: string
  ): Promise<T | undefined>;

  save<T = unknown>(
    content: T
  ): Promise<void>;
}

export interface ReaderAPI {
  open(contentId: string): Promise<void>;

  getSelection(): Promise<string | undefined>;
}

export interface PlayerAPI {
  play(url: string): Promise<void>;

  stop(): Promise<void>;
}

export interface UIAPI {
  registerPage(
    id: string,
    component: unknown
  ): void;

  registerWidget(
    id: string,
    component: unknown
  ): void;
}

export interface NotificationAPI {
  notify(
    title: string,
    message?: string
  ): Promise<void>;
}

export interface SettingsAPI {
  get<T = unknown>(
    key: string
  ): Promise<T | undefined>;

  set<T = unknown>(
    key: string,
    value: T
  ): Promise<void>;
}

export interface PluginContext {
  plugin: PluginInfo;

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
