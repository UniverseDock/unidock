import type { Content, ContentRepository } from '@unidock/content';
import type {
  DocumentRepository,
  ReaderDocument,
  ReadingState,
  ReadingStateRepository
} from '@unidock/reader';

export class ContentLifecycleError extends Error {
  constructor(
    message: string,
    override readonly cause: unknown
  ) {
    super(message, { cause });
    this.name = 'ContentLifecycleError';
  }
}

export class ContentLifecycle {
  constructor(
    private readonly contents: ContentRepository,
    private readonly documents: DocumentRepository,
    private readonly states: ReadingStateRepository
  ) {}

  async save(content: Content, document: ReaderDocument): Promise<void> {
    if (document.contentId !== content.id) {
      throw new Error('Content and Reader document must reference the same content ID.');
    }

    const previousContent = await this.contents.get(content.id);
    const previousDocument = await this.documents.get(document.id);

    try {
      await this.contents.save(content);
      await this.documents.save(document);
    } catch (error) {
      await this.restoreContent(content.id, previousContent);
      await this.restoreDocument(document.id, previousDocument);
      throw new ContentLifecycleError(
        `Unable to save content and document: ${content.id}.`,
        error
      );
    }
  }

  async delete(contentId: string): Promise<void> {
    const documentId = `document:${contentId}`;
    const previousContent = await this.contents.get(contentId);
    const previousDocument = await this.documents.get(documentId);
    const previousState = await this.states.get(contentId);

    try {
      await this.contents.delete(contentId);
      await this.documents.delete(documentId);
      await this.states.delete(contentId);
    } catch (error) {
      await this.restoreContent(contentId, previousContent);
      await this.restoreDocument(documentId, previousDocument);
      await this.restoreState(contentId, previousState);
      throw new ContentLifecycleError(
        `Unable to delete content and related records: ${contentId}.`,
        error
      );
    }
  }

  private async restoreContent(
    contentId: string,
    previous: Content | undefined
  ): Promise<void> {
    if (previous) {
      await this.contents.save(previous);
    } else {
      await this.contents.delete(contentId);
    }
  }

  private async restoreDocument(
    documentId: string,
    previous: ReaderDocument | undefined
  ): Promise<void> {
    if (previous) {
      await this.documents.save(previous);
    } else {
      await this.documents.delete(documentId);
    }
  }

  private async restoreState(
    contentId: string,
    previous: ReadingState | undefined
  ): Promise<void> {
    if (previous) {
      await this.states.save(previous);
    } else {
      await this.states.delete(contentId);
    }
  }
}
