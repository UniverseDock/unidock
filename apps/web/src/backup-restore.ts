import type { Content, ContentRepository } from '@unidock/content';
import type { ReadingState, ReadingStateRepository } from '@unidock/reader';
import type { StorageCollection } from '@unidock/storage';
import {
  parseBackup,
  type BackupDocument,
  type BackupPayload,
  type BackupState,
  type FeedSubscription
} from './backup.js';

export class BackupRestoreError extends Error {
  constructor(
    message: string,
    override readonly cause: unknown,
    readonly compensationError?: unknown
  ) {
    super(message, { cause });
    this.name = 'BackupRestoreError';
  }
}

export interface BackupRestoreDependencies {
  contents: ContentRepository;
  documents: StorageCollection<BackupDocument>;
  states: ReadingStateRepository;
  feeds: StorageCollection<FeedSubscription>;
}

interface Snapshot {
  contents: Map<string, Content | undefined>;
  documents: Map<string, BackupDocument | undefined>;
  states: Map<string, ReadingState | undefined>;
  feeds: Map<string, FeedSubscription | undefined>;
}

export class BackupRestoreService {
  constructor(private readonly dependencies: BackupRestoreDependencies) {}

  async restoreText(text: string): Promise<BackupPayload> {
    const payload = parseBackup(text);
    await this.restore(payload);
    return payload;
  }

  async restore(payload: BackupPayload): Promise<void> {
    const snapshot = await this.snapshot(payload);

    try {
      for (const content of payload.contents) await this.dependencies.contents.save(content);
      for (const document of payload.documents) await this.dependencies.documents.put(document);
      for (const state of payload.states) {
        await this.dependencies.states.save(toReadingState(state));
      }
      for (const feed of payload.feeds) await this.dependencies.feeds.put(feed);
    } catch (error) {
      try {
        await this.restoreSnapshot(snapshot);
      } catch (compensationError) {
        throw new BackupRestoreError(
          'Backup restore failed and compensation was incomplete.',
          error,
          compensationError
        );
      }
      throw new BackupRestoreError('Backup restore failed; previous records were restored.', error);
    }
  }

  private async snapshot(payload: BackupPayload): Promise<Snapshot> {
    const [contents, documents, states, feeds] = await Promise.all([
      Promise.all(payload.contents.map(async (content): Promise<[string, Content | undefined]> => [
        content.id,
        await this.dependencies.contents.get(content.id)
      ])),
      Promise.all(payload.documents.map(async (document): Promise<[string, BackupDocument | undefined]> => [
        document.id,
        await this.dependencies.documents.get(document.id)
      ])),
      Promise.all(payload.states.map(async (state): Promise<[string, ReadingState | undefined]> => [
        state.contentId,
        await this.dependencies.states.get(state.contentId)
      ])),
      Promise.all(payload.feeds.map(async (feed): Promise<[string, FeedSubscription | undefined]> => [
        feed.id,
        await this.dependencies.feeds.get(feed.id)
      ]))
    ]);

    return {
      contents: new Map(contents),
      documents: new Map(documents),
      states: new Map(states),
      feeds: new Map(feeds)
    };
  }

  private async restoreSnapshot(snapshot: Snapshot): Promise<void> {
    for (const [id, record] of snapshot.contents) {
      if (record) await this.dependencies.contents.save(record);
      else await this.dependencies.contents.delete(id);
    }
    for (const [id, record] of snapshot.documents) {
      if (record) await this.dependencies.documents.put(record);
      else await this.dependencies.documents.delete(id);
    }
    for (const [id, record] of snapshot.states) {
      if (record) await this.dependencies.states.save(record);
      else await this.dependencies.states.delete(id);
    }
    for (const [id, record] of snapshot.feeds) {
      if (record) await this.dependencies.feeds.put(record);
      else await this.dependencies.feeds.delete(id);
    }
  }
}

function toReadingState(state: BackupState): ReadingState {
  const { id: _storageId, ...readingState } = state;
  return readingState;
}
