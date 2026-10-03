import { StorageContentRepository, type Content } from '@unidock/content';
import {
  createArticleDocument,
  StorageDocumentRepository,
  StorageReadingStateRepository,
  type ReadingState,
  type ReaderBlock
} from '@unidock/reader';
import { FeedFetcher, FeedImportService } from '@unidock/rss';
import { IndexedDBAdapter, StorageError } from '@unidock/storage';
import type { Storage, StorageCollection, StorageRecord } from '@unidock/storage';
import {
  createBackupPayload,
  type BackupDocument,
  type BackupState,
  type FeedSubscription
} from './backup.js';
import { BackupRestoreService } from './backup-restore.js';
import { ContentLifecycle } from './content-lifecycle.js';

const feedForm = getElement<HTMLFormElement>('feed-form');
const feedUrlInput = getElement<HTMLInputElement>('feed-url');
const feedSubmit = getElement<HTMLButtonElement>('feed-submit');
const feedRefresh = getElement<HTMLButtonElement>('feed-refresh');
const feedRetry = getElement<HTMLButtonElement>('feed-retry');
const feedImportStatus = getElement<HTMLElement>('feed-import-status');
const feedError = getElement<HTMLElement>('feed-error');
const feedList = getElement<HTMLUListElement>('feed-list');
const form = getElement<HTMLFormElement>('content-form');
const titleInput = getElement<HTMLInputElement>('title');
const sourceInput = getElement<HTMLInputElement>('sourceId');
const tagsInput = getElement<HTMLInputElement>('tags');
const bodyInput = getElement<HTMLTextAreaElement>('body');
const list = getElement<HTMLUListElement>('content-list');
const count = getElement<HTMLElement>('content-count');
const loading = getElement<HTMLElement>('loading');
const emptyState = getElement<HTMLElement>('empty-state');
const formError = getElement<HTMLElement>('form-error');
const listError = getElement<HTMLElement>('list-error');
const connectionStatus = getElement<HTMLElement>('connection-status');
const storageRetry = getElement<HTMLButtonElement>('storage-retry');
const contentSearch = getElement<HTMLInputElement>('content-search');
const contentStatusFilter = getElement<HTMLSelectElement>('content-status-filter');
const readerPanel = getElement<HTMLElement>('reader-panel');
const readerTitle = getElement<HTMLElement>('reader-title');
const readerDocument = getElement<HTMLElement>('reader-document');
const readerError = getElement<HTMLElement>('reader-error');
const readerState = getElement<HTMLElement>('reader-state');
const toggleRead = getElement<HTMLButtonElement>('toggle-read');
const toggleStarred = getElement<HTMLButtonElement>('toggle-starred');
const backToList = getElement<HTMLButtonElement>('back-to-list');
const networkStatus = getElement<HTMLElement>('network-status');
const appUpdateStatus = getElement<HTMLElement>('app-update-status');
const appUpdateApply = getElement<HTMLButtonElement>('app-update-apply');
const exportDataButton = getElement<HTMLButtonElement>('export-data');
const importDataButton = getElement<HTMLButtonElement>('import-data');
const importFileInput = getElement<HTMLInputElement>('import-file');
const backupStatus = getElement<HTMLElement>('backup-status');

window.addEventListener('online', renderNetworkStatus);
window.addEventListener('offline', renderNetworkStatus);
renderNetworkStatus();

const adapter = new IndexedDBAdapter({ databaseName: 'unidock' });
let repository: StorageContentRepository | undefined;
let storage: Storage | undefined;
let documentRepository: StorageDocumentRepository | undefined;
let stateRepository: StorageReadingStateRepository | undefined;
let feedImportService: FeedImportService | undefined;
let feedSubscriptions: StorageCollection<FeedSubscription> | undefined;
let contentLifecycle: ContentLifecycle | undefined;
let failedFeedRetry: { url: string; refresh: boolean } | undefined;
let activeContentId: string | undefined;
let activeDocument: Awaited<ReturnType<StorageDocumentRepository['getByContentId']>> | undefined;
let activeState: ReadingState | undefined;
let savePositionTimer: number | undefined;
let allowReload = false;
let pendingCrossTabUpdate = false;
let startPromise: Promise<void> | undefined;
const updateStateKey = 'unidock-service-worker-update-state';
const updateTabId = getUpdateTabId();
const updateChannel = 'BroadcastChannel' in window
  ? new BroadcastChannel('unidock-service-worker-update')
  : undefined;

if ('serviceWorker' in navigator) {
  void registerServiceWorker();
}

async function registerServiceWorker(): Promise<void> {
  try {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (allowReload) {
        allowReload = false;
        publishUpdateState('applied');
        updateChannel?.postMessage({
          type: 'UPDATE_APPLIED',
          sourceTabId: updateTabId
        });
        window.location.reload();
      } else if (pendingCrossTabUpdate) {
        showReloadRequired();
      }
    });
    updateChannel?.addEventListener('message', (event) => {
      handleUpdateMessage(event.data);
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== updateStateKey || !event.newValue) return;
      handleUpdateState(parseUpdateState(event.newValue));
    });
    const registration = await navigator.serviceWorker.register('./sw.js');
    handleUpdateState(readUpdateState());
    const checkForUpdate = (): void => {
      if (document.visibilityState !== 'visible') return;
      void registration.update()
        .then(() => {
          if (registration.waiting) showUpdateStatus(registration);
        })
        .catch(() => {
          // 更新检查失败不影响当前已安装版本继续运行。
        });
    };

    if (registration.waiting) showUpdateStatus(registration);
    registration.addEventListener('updatefound', () => {
      appUpdateStatus.hidden = true;
      appUpdateApply.hidden = true;
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateStatus(registration);
        }
      });
    });
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('focus', checkForUpdate);
  } catch {
    appUpdateStatus.textContent = '离线缓存暂不可用';
    appUpdateStatus.hidden = false;
  }
}

function renderNetworkStatus(): void {
  const online = navigator.onLine;
  networkStatus.textContent = online ? '在线' : '离线模式';
  networkStatus.classList.toggle('offline', !online);
  feedSubmit.disabled = !online;
  feedRefresh.disabled = !online;
  feedUrlInput.disabled = !online;
  if (!online) {
    feedImportStatus.textContent = '离线模式下只能阅读已保存内容';
  } else if (feedImportStatus.textContent === '离线模式下只能阅读已保存内容') {
    feedImportStatus.textContent = '可以导入或刷新 Feed';
  }
}

function showUpdateStatus(registration: ServiceWorkerRegistration): void {
  appUpdateStatus.textContent = '发现新版本，点击立即更新。';
  appUpdateStatus.hidden = false;
  appUpdateApply.hidden = false;
  appUpdateApply.textContent = '立即更新';
  publishUpdateState('available');
  updateChannel?.postMessage({
    type: 'UPDATE_AVAILABLE',
    sourceTabId: updateTabId
  });
  appUpdateApply.onclick = () => {
    const worker = registration.waiting;
    if (!worker) return;
    allowReload = true;
    publishUpdateState('applying');
    updateChannel?.postMessage({
      type: 'UPDATE_APPLYING',
      sourceTabId: updateTabId
    });
    appUpdateStatus.textContent = '正在更新…';
    appUpdateApply.hidden = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

function showPassiveUpdateStatus(): void {
  if (!appUpdateApply.hidden) return;
  appUpdateStatus.textContent = '发现新版本，请在其他标签页更新后刷新此页面。';
  appUpdateStatus.hidden = false;
}

function showReloadRequired(): void {
  appUpdateStatus.textContent = '新版本已生效，请刷新页面。';
  appUpdateStatus.hidden = false;
  appUpdateApply.textContent = '刷新页面';
  appUpdateApply.hidden = false;
  appUpdateApply.onclick = () => window.location.reload();
}

type UpdateState = {
  status: 'available' | 'applying' | 'applied';
  sourceTabId: string;
  updatedAt: number;
};

function getUpdateTabId(): string {
  const existing = window.sessionStorage.getItem('unidock-update-tab-id');
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem('unidock-update-tab-id', created);
  return created;
}

function publishUpdateState(status: UpdateState['status']): void {
  const state: UpdateState = {
    status,
    sourceTabId: updateTabId,
    updatedAt: Date.now()
  };
  window.localStorage.setItem(updateStateKey, JSON.stringify(state));
}

function readUpdateState(): UpdateState | undefined {
  const value = window.localStorage.getItem(updateStateKey);
  return value ? parseUpdateState(value) : undefined;
}

function parseUpdateState(value: string): UpdateState | undefined {
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      (parsed.status === 'available' || parsed.status === 'applying' || parsed.status === 'applied') &&
      typeof parsed.sourceTabId === 'string' &&
      typeof parsed.updatedAt === 'number'
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed state left by an interrupted update attempt.
  }
  return undefined;
}

function handleUpdateMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const event = message as { type?: string; sourceTabId?: string };
  if (event.sourceTabId === updateTabId) return;
  if (event.type === 'UPDATE_AVAILABLE') {
    handleUpdateState({
      status: 'available',
      sourceTabId: event.sourceTabId ?? 'broadcast',
      updatedAt: Date.now()
    });
  } else if (event.type === 'UPDATE_APPLYING') {
    handleUpdateState({
      status: 'applying',
      sourceTabId: event.sourceTabId ?? 'broadcast',
      updatedAt: Date.now()
    });
  } else if (event.type === 'UPDATE_APPLIED') {
    handleUpdateState({
      status: 'applied',
      sourceTabId: event.sourceTabId ?? 'broadcast',
      updatedAt: Date.now()
    });
  }
}

function handleUpdateState(state: UpdateState | undefined): void {
  if (!state || state.sourceTabId === updateTabId) return;
  if (Date.now() - state.updatedAt > 60_000) return;
  pendingCrossTabUpdate = true;
  if (state.status === 'applied') {
    showReloadRequired();
  } else if (state.status === 'applying') {
    appUpdateStatus.textContent = '其他标签页正在更新，当前页面稍后需要刷新。';
    appUpdateStatus.hidden = false;
    appUpdateApply.hidden = true;
  } else {
    showPassiveUpdateStatus();
  }
}

async function start(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = startStorage();
  try {
    await startPromise;
  } finally {
    startPromise = undefined;
  }
}

async function startStorage(): Promise<void> {
  try {
    storageRetry.hidden = true;
    connectionStatus.textContent = '正在连接…';
    hideError(listError);
    await adapter.destroy();
    storage = await adapter.create();
    feedSubscriptions = storage.collection<FeedSubscription>('feed-subscriptions');
    repository = new StorageContentRepository(storage);
    documentRepository = new StorageDocumentRepository(storage);
    stateRepository = new StorageReadingStateRepository(storage);
    contentLifecycle = new ContentLifecycle(repository, documentRepository, stateRepository);
    feedImportService = new FeedImportService(repository, documentRepository, new FeedFetcher());
    connectionStatus.textContent = '已连接到本地存储';
    await renderContents();
    await renderFeedSubscriptions();
    await requestPersistentStorage();
  } catch (error) {
    storage = undefined;
    repository = undefined;
    documentRepository = undefined;
    stateRepository = undefined;
    feedImportService = undefined;
    feedSubscriptions = undefined;
    contentLifecycle = undefined;
    connectionStatus.textContent = '连接失败';
    showError(listError, toErrorMessage(error));
    loading.hidden = true;
    storageRetry.hidden = false;
  }
}

storageRetry.addEventListener('click', () => {
  void start();
});

async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const granted = await navigator.storage.persisted() || await navigator.storage.persist();
    connectionStatus.textContent = granted
      ? '已连接到本地存储（持久化）'
      : '已连接到本地存储（浏览器可能清理数据）';
  } catch {
    // 持久化请求失败不影响正常使用。
  }
}

feedForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void importFeed();
});

feedRefresh.addEventListener('click', () => {
  void importFeed(true);
});

feedRetry.addEventListener('click', () => {
  const retry = failedFeedRetry;
  if (!retry) return;
  void importFeed(retry.refresh);
});

feedList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.dataset.action !== 'refresh-feed') return;
  const url = target.dataset.feedUrl;
  if (!url) return;
  void refreshFeed({ id: `feed:${url}`, url, title: '', updatedAt: 0 });
});

feedList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.dataset.action !== 'remove-feed') return;
  const url = target.dataset.feedUrl;
  if (!url) return;
  void removeFeed(url);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveContent();
});

contentSearch.addEventListener('input', () => {
  void renderContents();
});

contentStatusFilter.addEventListener('change', () => {
  void renderContents();
});

exportDataButton.addEventListener('click', () => {
  void exportData();
});

importDataButton.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', () => {
  const file = importFileInput.files?.[0];
  importFileInput.value = '';
  if (file) void importData(file);
});

list.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const contentId = target.dataset.contentId;
  if (!contentId) return;
  if (target.dataset.action === 'open') {
    void openContent(contentId);
  } else {
    void removeContent(contentId);
  }
});

backToList.addEventListener('click', () => {
  void saveActivePosition();
  readerPanel.hidden = true;
  list.closest('.panel')?.removeAttribute('hidden');
});

toggleRead.addEventListener('click', () => {
  void updateActiveState({ read: !activeState?.read });
});

toggleStarred.addEventListener('click', () => {
  void updateActiveState({ starred: !activeState?.starred });
});

window.addEventListener('scroll', () => {
  if (savePositionTimer !== undefined) window.clearTimeout(savePositionTimer);
  savePositionTimer = window.setTimeout(() => {
    savePositionTimer = undefined;
    void saveActivePosition();
  }, 250);
});

window.addEventListener('pagehide', () => {
  void saveActivePosition();
  void adapter.destroy();
  updateChannel?.close();
});

async function saveContent(): Promise<void> {
  if (!repository) return;
  hideError(formError);

  const title = titleInput.value.trim();
  if (!title) {
    showError(formError, '标题不能为空。');
    titleInput.focus();
    return;
  }

  const content: Content = {
    id: crypto.randomUUID(),
    type: 'article',
    title,
    sourceId: sourceInput.value.trim() || undefined,
    tags: tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  try {
    if (!documentRepository || !contentLifecycle) return;
    const blocks = bodyInput.value
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ type: 'paragraph' as const, text }));
    await contentLifecycle.save(content, createArticleDocument(content, { blocks }));
    form.reset();
    await renderContents();
  } catch (error) {
    showError(formError, toErrorMessage(error));
  }
}

async function importFeed(refresh = false): Promise<void> {
  if (!feedImportService || !feedSubscriptions) return;
  const feedUrl = feedUrlInput.value.trim();
  if (!feedUrl) {
    showError(feedError, 'Feed URL 不能为空。');
    return;
  }
  hideError(feedError);
  failedFeedRetry = undefined;
  feedRetry.hidden = true;
  feedSubmit.disabled = true;
  feedRefresh.disabled = true;
  feedImportStatus.textContent = refresh ? '正在重新抓取…' : '正在抓取和导入…';

  try {
    const result = await feedImportService.importFromUrl({
      feedUrl
    });
    await saveFeedSubscription(feedUrl, result.feed.title);
    feedImportStatus.textContent = `${refresh ? '已重新抓取' : '已导入'} ${result.contents.length} 篇：${result.feed.title}`;
    await renderContents();
    await renderFeedSubscriptions();
  } catch (error) {
    failedFeedRetry = { url: feedUrl, refresh };
    feedImportStatus.textContent = `${refresh ? '重新抓取失败' : '导入失败'}，可以重试`;
    feedRetry.hidden = false;
    showError(feedError, toErrorMessage(error));
  } finally {
    renderNetworkStatus();
  }
}

async function refreshFeed(feed: FeedSubscription): Promise<void> {
  feedUrlInput.value = feed.url;
  await importFeed(true);
}

async function saveFeedSubscription(url: string, title: string): Promise<void> {
  if (!feedSubscriptions) return;
  const normalizedUrl = new URL(url).toString();
  await feedSubscriptions.put({
    id: `feed:${normalizedUrl}`,
    url: normalizedUrl,
    title,
    updatedAt: Date.now()
  });
}

async function renderFeedSubscriptions(): Promise<void> {
  if (!feedSubscriptions) return;
  const feeds = await feedSubscriptions.list();
  feeds.sort((left, right) => right.updatedAt - left.updatedAt);
  feedList.replaceChildren(...feeds.map(renderFeedSubscription));
}

async function removeFeed(url: string): Promise<void> {
  if (!feedSubscriptions) return;
  hideError(feedError);
  try {
    await feedSubscriptions.delete(`feed:${new URL(url).toString()}`);
    await renderFeedSubscriptions();
    feedImportStatus.textContent = '已移除 Feed 订阅，已导入内容保留。';
  } catch (error) {
    showError(feedError, toErrorMessage(error));
  }
}

async function exportData(): Promise<void> {
  if (!repository || !storage || !feedSubscriptions) return;
  backupStatus.textContent = '正在准备导出…';
  try {
    const [contents, documents, states, feeds] = await Promise.all([
      repository.list(),
      storage.collection<BackupDocument>('reader-documents').list(),
      storage.collection<BackupState>('reader-state').list(),
      feedSubscriptions.list()
    ]);
    const payload = createBackupPayload(contents, documents, states, feeds);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unidock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    backupStatus.textContent = `已导出 ${contents.length} 条内容和 ${feeds.length} 个 Feed。`;
  } catch (error) {
    backupStatus.textContent = `导出失败：${toErrorMessage(error)}`;
  }
}

async function importData(file: File): Promise<void> {
  if (!repository || !storage || !stateRepository || !feedSubscriptions) return;
  const maxBackupBytes = 10 * 1024 * 1024;
  if (file.size > maxBackupBytes) {
    backupStatus.textContent = '恢复失败：备份文件不能超过 10 MB。';
    return;
  }
  if (!window.confirm('导入会合并备份数据，并覆盖相同 ID 的本地记录。是否继续？')) {
    backupStatus.textContent = '已取消恢复。';
    return;
  }
  backupStatus.textContent = '正在读取备份…';
  try {
    const documents = storage.collection<BackupDocument>('reader-documents');
    const payload = await new BackupRestoreService({
      contents: repository,
      documents,
      states: stateRepository,
      feeds: feedSubscriptions
    }).restoreText(await file.text());
    await renderContents();
    await renderFeedSubscriptions();
    backupStatus.textContent = `已恢复 ${payload.contents.length} 条内容和 ${payload.feeds.length} 个 Feed。`;
  } catch (error) {
    backupStatus.textContent = `恢复失败：${toErrorMessage(error)}`;
  }
}

function renderFeedSubscription(feed: FeedSubscription): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'feed-item';
  const details = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = feed.title || feed.url;
  const url = document.createElement('span');
  url.className = 'content-meta';
  url.textContent = feed.url;
  details.append(title, url);

  const refresh = document.createElement('button');
  refresh.className = 'secondary-button';
  refresh.dataset.action = 'refresh-feed';
  refresh.dataset.feedUrl = feed.url;
  refresh.type = 'button';
  refresh.textContent = '刷新';
  const remove = document.createElement('button');
  remove.className = 'delete-button';
  remove.dataset.action = 'remove-feed';
  remove.dataset.feedUrl = feed.url;
  remove.type = 'button';
  remove.textContent = '移除';
  const actions = document.createElement('div');
  actions.className = 'content-actions';
  actions.append(refresh, remove);
  item.append(details, actions);
  return item;
}

async function removeContent(contentId: string): Promise<void> {
  if (!contentLifecycle) return;
  hideError(listError);

  try {
    await contentLifecycle.delete(contentId);
    await renderContents();
  } catch (error) {
    showError(listError, toErrorMessage(error));
  }
}

async function renderContents(): Promise<void> {
  if (!repository || !stateRepository) return;
  hideError(listError);
  loading.hidden = false;
  emptyState.hidden = true;

  try {
    const contents = await repository.list();
    const states = await Promise.all(contents.map(async (content) => [
      content.id,
      await stateRepository?.get(content.id)
    ] as const));
    const stateByContentId = new Map(states);
    const filtered = contents.filter((content) => {
      const state = stateByContentId.get(content.id);
      return matchesContentSearch(content) && matchesContentStatus(state);
    });
    list.replaceChildren(...filtered.map((content) =>
      renderContent(content, stateByContentId.get(content.id))
    ));
    count.textContent = `${filtered.length} / ${contents.length} 条`;
    emptyState.hidden = filtered.length !== 0;
  } catch (error) {
    showError(listError, toErrorMessage(error));
  } finally {
    loading.hidden = true;
  }
}

function renderContent(content: Content, state: ReadingState | undefined): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'content-item';

  const details = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = content.title;
  const metadata = document.createElement('p');
  metadata.className = 'content-meta';
  metadata.textContent = [content.sourceId, content.tags?.join(' · ')].filter(Boolean).join(' · ') || '无来源信息';
  const status = document.createElement('p');
  status.className = 'content-meta';
  status.textContent = [
    state?.read ? '已读' : '未读',
    state?.starred ? '已收藏' : '未收藏'
  ].join(' · ');
  details.append(title, metadata, status);

  const actions = document.createElement('div');
  actions.className = 'content-actions';

  const openButton = document.createElement('button');
  openButton.className = 'open-button';
  openButton.dataset.action = 'open';
  openButton.dataset.contentId = content.id;
  openButton.type = 'button';
  openButton.textContent = '打开';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-button';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.contentId = content.id;
  deleteButton.type = 'button';
  deleteButton.textContent = '删除';

  actions.append(openButton, deleteButton);
  item.append(details, actions);
  return item;
}

function matchesContentSearch(content: Content): boolean {
  const search = contentSearch.value.trim().toLocaleLowerCase();
  if (!search) return true;
  return [content.title, content.sourceId, ...(content.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(search));
}

function matchesContentStatus(state: ReadingState | undefined): boolean {
  switch (contentStatusFilter.value) {
    case 'read':
      return state?.read === true;
    case 'unread':
      return state?.read !== true;
    case 'starred':
      return state?.starred === true;
    default:
      return true;
  }
}

async function openContent(contentId: string): Promise<void> {
  if (!repository || !documentRepository || !stateRepository) return;
  await saveActivePosition();
  activeContentId = contentId;
  activeDocument = undefined;
  activeState = undefined;
  hideError(readerError);
  readerDocument.replaceChildren();
  readerPanel.hidden = false;
  list.closest('.panel')?.setAttribute('hidden', '');

  try {
    const content = await repository.get(contentId);
    if (!content) throw new Error('找不到这篇内容。');
    const document = await documentRepository.getByContentId(contentId);
    if (!document) throw new Error('这篇内容还没有可阅读的正文。');
    activeDocument = document;
    activeState = await stateRepository.get(contentId);
    readerTitle.textContent = document.title;
    renderReaderState();
    readerDocument.append(...document.blocks.map(renderBlock));
    restorePosition();
  } catch (error) {
    showError(readerError, toErrorMessage(error));
  }
}

async function updateActiveState(patch: Partial<Pick<ReadingState, 'read' | 'starred'>>): Promise<void> {
  if (!activeContentId || !activeDocument || !stateRepository) return;
  const current = activeState ?? createDefaultState(activeContentId, activeDocument);
  activeState = {
    ...current,
    ...patch,
    updatedAt: Date.now()
  };
  try {
    await stateRepository.save(activeState);
    renderReaderState();
    await renderContents();
  } catch (error) {
    showError(readerError, toErrorMessage(error));
  }
}

async function saveActivePosition(): Promise<void> {
  if (!activeContentId || !activeDocument || !stateRepository) return;
  const current = activeState ?? createDefaultState(activeContentId, activeDocument);
  const block = findVisibleBlock();
  const nextState: ReadingState = {
    ...current,
    position: block ? { blockId: block.id, offset: 0 } : current.position,
    updatedAt: Date.now()
  };
  activeState = nextState;
  await stateRepository.save(nextState);
}

function createDefaultState(contentId: string, document: NonNullable<typeof activeDocument>): ReadingState {
  return {
    contentId,
    documentId: document.id,
    documentVersion: document.version,
    read: false,
    starred: false,
    updatedAt: Date.now()
  };
}

function findVisibleBlock(): HTMLElement | undefined {
  const blocks = [...readerDocument.children].filter((element): element is HTMLElement => element instanceof HTMLElement);
  return blocks.find((block) => block.getBoundingClientRect().bottom >= readerDocument.getBoundingClientRect().top);
}

function restorePosition(): void {
  const position = activeState?.position;
  if (!position) return;
  const block = document.getElementById(position.blockId);
  block?.scrollIntoView({ block: 'start' });
}

function renderReaderState(): void {
  if (!activeState) {
    readerState.textContent = '';
    toggleRead.textContent = '标记已读';
    toggleStarred.textContent = '收藏';
    return;
  }
  readerState.textContent = [
    activeState.read ? '已读' : '未读',
    activeState.starred ? '已收藏' : '未收藏'
  ].join(' · ');
  toggleRead.textContent = activeState.read ? '标记未读' : '标记已读';
  toggleStarred.textContent = activeState.starred ? '取消收藏' : '收藏';
}

function renderBlock(block: ReaderBlock): HTMLElement {
  switch (block.type) {
    case 'heading': {
      const heading = document.createElement(`h${block.level}`);
      heading.id = block.id;
      heading.textContent = block.text;
      return heading;
    }
    case 'paragraph': {
      const paragraph = document.createElement('p');
      paragraph.id = block.id;
      paragraph.textContent = block.text;
      return paragraph;
    }
    case 'quote': {
      const quote = document.createElement('blockquote');
      quote.id = block.id;
      quote.textContent = block.cite ? `${block.text} — ${block.cite}` : block.text;
      return quote;
    }
    case 'code': {
      const pre = document.createElement('pre');
      pre.id = block.id;
      const code = document.createElement('code');
      code.textContent = block.code;
      pre.append(code);
      return pre;
    }
    case 'list': {
      const listElement = document.createElement(block.ordered ? 'ol' : 'ul');
      listElement.id = block.id;
      listElement.append(...block.items.map((item) => {
        const listItem = document.createElement('li');
        listItem.textContent = item;
        return listItem;
      }));
      return listElement;
    }
    case 'image': {
      const figure = document.createElement('figure');
      figure.id = block.id;
      const image = document.createElement('img');
      image.src = block.src;
      image.alt = block.alt;
      figure.append(image);
      if (block.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = block.caption;
        figure.append(caption);
      }
      return figure;
    }
    case 'divider': {
      const divider = document.createElement('hr');
      divider.id = block.id;
      return divider;
    }
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing Web App element: ${id}`);
  return element as unknown as T;
}

function showError(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.hidden = false;
}

function hideError(element: HTMLElement): void {
  element.textContent = '';
  element.hidden = true;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof StorageError) {
    switch (error.code) {
      case 'unavailable':
        return '当前浏览器不支持本地存储。';
      case 'open-blocked':
        return '本地存储正在被其他页面占用，请关闭其他 UniDock 页面后重试。';
      case 'quota-exceeded':
        return '本地存储空间不足，请清理内容或导出备份后重试。';
      case 'open-failed':
      case 'request-failed':
      case 'transaction-failed':
        return '本地存储操作失败，请刷新页面后重试。';
      case 'closed':
        return '本地存储连接已关闭，请重试连接。';
      case 'version-conflict':
        return '本地存储版本不兼容，请刷新页面后重试。';
    }
  }
  if (isQuotaError(error)) {
    return '本地存储空间不足，请清理内容或导出备份后重试。';
  }
  return error instanceof Error ? error.message : '发生未知错误。';
}

function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return error instanceof Error && /quota/i.test(error.message);
}

void start();
