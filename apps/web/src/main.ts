import { StorageContentRepository, type Content } from '@unidock/content';
import {
  createArticleDocument,
  StorageDocumentRepository,
  StorageReadingStateRepository,
  type ReadingState,
  type ReaderBlock
} from '@unidock/reader';
import { FeedFetcher, FeedImportService } from '@unidock/rss';
import { IndexedDBAdapter } from '@unidock/storage';
import type { StorageCollection, StorageRecord } from '@unidock/storage';

interface FeedSubscription extends StorageRecord {
  url: string;
  title: string;
  updatedAt: number;
}

const feedForm = getElement<HTMLFormElement>('feed-form');
const feedUrlInput = getElement<HTMLInputElement>('feed-url');
const feedSubmit = getElement<HTMLButtonElement>('feed-submit');
const feedRefresh = getElement<HTMLButtonElement>('feed-refresh');
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
const readerPanel = getElement<HTMLElement>('reader-panel');
const readerTitle = getElement<HTMLElement>('reader-title');
const readerDocument = getElement<HTMLElement>('reader-document');
const readerError = getElement<HTMLElement>('reader-error');
const readerState = getElement<HTMLElement>('reader-state');
const toggleRead = getElement<HTMLButtonElement>('toggle-read');
const toggleStarred = getElement<HTMLButtonElement>('toggle-starred');
const backToList = getElement<HTMLButtonElement>('back-to-list');

const adapter = new IndexedDBAdapter({ databaseName: 'unidock' });
let repository: StorageContentRepository | undefined;
let documentRepository: StorageDocumentRepository | undefined;
let stateRepository: StorageReadingStateRepository | undefined;
let feedImportService: FeedImportService | undefined;
let feedSubscriptions: StorageCollection<FeedSubscription> | undefined;
let activeContentId: string | undefined;
let activeDocument: Awaited<ReturnType<StorageDocumentRepository['getByContentId']>> | undefined;
let activeState: ReadingState | undefined;
let savePositionTimer: number | undefined;

async function start(): Promise<void> {
  try {
    const storage = await adapter.create();
    feedSubscriptions = storage.collection<FeedSubscription>('feed-subscriptions');
    repository = new StorageContentRepository(storage);
    documentRepository = new StorageDocumentRepository(storage);
    stateRepository = new StorageReadingStateRepository(storage);
    feedImportService = new FeedImportService(repository, documentRepository, new FeedFetcher());
    connectionStatus.textContent = '已连接到本地存储';
    await renderContents();
    await renderFeedSubscriptions();
  } catch (error) {
    connectionStatus.textContent = '连接失败';
    showError(listError, toErrorMessage(error));
    loading.hidden = true;
  }
}

feedForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void importFeed();
});

feedRefresh.addEventListener('click', () => {
  void importFeed(true);
});

feedList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.dataset.action !== 'refresh-feed') return;
  const url = target.dataset.feedUrl;
  if (!url) return;
  void refreshFeed({ id: `feed:${url}`, url, title: '', updatedAt: 0 });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveContent();
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
    await repository.save(content);
    if (documentRepository) {
      const blocks = bodyInput.value
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ type: 'paragraph' as const, text }));
      await documentRepository.save(createArticleDocument(content, { blocks }));
    }
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
    feedImportStatus.textContent = '导入失败';
    showError(feedError, toErrorMessage(error));
  } finally {
    feedSubmit.disabled = false;
    feedRefresh.disabled = false;
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
  item.append(details, refresh);
  return item;
}

async function removeContent(contentId: string): Promise<void> {
  if (!repository) return;
  hideError(listError);

  try {
    await repository.delete(contentId);
    await documentRepository?.delete(`document:${contentId}`);
    await stateRepository?.delete(contentId);
    await renderContents();
  } catch (error) {
    showError(listError, toErrorMessage(error));
  }
}

async function renderContents(): Promise<void> {
  if (!repository) return;
  hideError(listError);
  loading.hidden = false;
  emptyState.hidden = true;

  try {
    const contents = await repository.list();
    list.replaceChildren(...contents.map(renderContent));
    count.textContent = `${contents.length} 条`;
    emptyState.hidden = contents.length !== 0;
  } catch (error) {
    showError(listError, toErrorMessage(error));
  } finally {
    loading.hidden = true;
  }
}

function renderContent(content: Content): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'content-item';

  const details = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = content.title;
  const metadata = document.createElement('p');
  metadata.className = 'content-meta';
  metadata.textContent = [content.sourceId, content.tags?.join(' · ')].filter(Boolean).join(' · ') || '无来源信息';
  details.append(title, metadata);

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
  return error instanceof Error ? error.message : '发生未知错误。';
}

void start();
