export interface FeedFetcherOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface FetchFeedOptions {
  signal?: AbortSignal;
}

export class FeedFetcher {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: FeedFetcherOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
  }

  async fetchXml(url: string, options: FetchFeedOptions = {}): Promise<string> {
    return this.fetchText(url, {
      ...options,
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9'
    });
  }

  async fetchHtml(url: string, options: FetchFeedOptions = {}): Promise<string> {
    return this.fetchText(url, {
      ...options,
      accept: 'text/html, application/xhtml+xml;q=0.9'
    });
  }

  private async fetchText(
    url: string,
    options: FetchFeedOptions & { accept: string }
  ): Promise<string> {
    validateUrl(url);
    const requestUrl = new URL(url);
    requestUrl.searchParams.set('_unidock_fetch', String(Date.now()));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new FeedFetchTimeoutError(url)), this.timeoutMs);
    const detachAbort = forwardAbort(options.signal, controller);

    try {
      const response = await this.fetchImpl(requestUrl.toString(), {
        headers: { accept: options.accept },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        throw new FeedHttpError(url, response.status, response.statusText);
      }
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > this.maxResponseBytes) {
        throw new FeedResponseTooLargeError(url, this.maxResponseBytes);
      }
      const xml = await response.text();
      if (!xml.trim()) throw new FeedEmptyResponseError(url);
      if (new TextEncoder().encode(xml).byteLength > this.maxResponseBytes) {
        throw new FeedResponseTooLargeError(url, this.maxResponseBytes);
      }
      return xml;
    } catch (error) {
      if (isAbortError(error)) {
        if (isTimeoutError(controller.signal.reason)) {
          throw controller.signal.reason;
        }
        throw new FeedFetchAbortedError(url);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      detachAbort();
    }
  }
}

export class FeedHttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly statusText: string
  ) {
    super(`Feed request failed with HTTP ${status}${statusText ? ` ${statusText}` : ''}.`);
    this.name = 'FeedHttpError';
  }
}

export class FeedFetchTimeoutError extends Error {
  constructor(readonly url: string) {
    super(`Feed request timed out: ${url}`);
    this.name = 'FeedFetchTimeoutError';
  }
}

export class FeedFetchAbortedError extends Error {
  constructor(readonly url: string) {
    super(`Feed request was cancelled: ${url}`);
    this.name = 'FeedFetchAbortedError';
  }
}

export class FeedResponseTooLargeError extends Error {
  constructor(readonly url: string, readonly maxBytes: number) {
    super(`Feed response exceeds the ${maxBytes}-byte limit.`);
    this.name = 'FeedResponseTooLargeError';
  }
}

export class FeedEmptyResponseError extends Error {
  constructor(readonly url: string) {
    super(`Feed response is empty: ${url}`);
    this.name = 'FeedEmptyResponseError';
  }
}

function validateUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`Invalid feed URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`Feed URL must use http or https: ${value}`);
  }
}

function forwardAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => {};
  }
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isTimeoutError(reason: unknown): reason is FeedFetchTimeoutError {
  return reason instanceof FeedFetchTimeoutError;
}
