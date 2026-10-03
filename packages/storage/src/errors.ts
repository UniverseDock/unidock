export type StorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'open-blocked'
  | 'request-failed'
  | 'transaction-failed'
  | 'quota-exceeded'
  | 'closed'
  | 'version-conflict';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: StorageErrorCode,
    readonly operation: string,
    override readonly cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'StorageError';
  }
}

export function toStorageError(
  error: unknown,
  operation: string,
  fallbackCode: Exclude<StorageErrorCode, 'unavailable' | 'open-blocked'> = 'request-failed'
): StorageError {
  if (error instanceof StorageError) return error;
  const code = classifyError(error, fallbackCode);
  return new StorageError(storageErrorMessage(code, operation), code, operation, error);
}

function classifyError(
  error: unknown,
  fallbackCode: Exclude<StorageErrorCode, 'unavailable' | 'open-blocked'>
): Exclude<StorageErrorCode, 'unavailable' | 'open-blocked'> {
  const name = error instanceof DOMException
    ? error.name
    : error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : undefined;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'quota-exceeded';
  }
  if (name === 'InvalidStateError' || name === 'TransactionInactiveError') {
    return 'closed';
  }
  if (name === 'VersionError') return 'version-conflict';
  return fallbackCode;
}

function storageErrorMessage(code: StorageErrorCode, operation: string): string {
  switch (code) {
    case 'unavailable':
      return 'IndexedDB is not available in this environment.';
    case 'open-failed':
      return `Unable to open IndexedDB during ${operation}.`;
    case 'open-blocked':
      return 'Opening the UniDock database was blocked by another browser context.';
    case 'quota-exceeded':
      return `IndexedDB quota was exceeded during ${operation}.`;
    case 'transaction-failed':
      return `IndexedDB transaction failed during ${operation}.`;
    case 'request-failed':
      return `IndexedDB request failed during ${operation}.`;
    case 'closed':
      return `IndexedDB was closed or inactive during ${operation}.`;
    case 'version-conflict':
      return `IndexedDB schema version conflict occurred during ${operation}.`;
  }
}
