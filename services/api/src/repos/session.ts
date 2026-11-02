import type { ConceptStateRecord, SkillStateRecord } from '@loqua/db-postgres';
import type {
  RecordAttemptInput,
  SessionItemRecord,
  SessionRecord,
  SessionStore,
  SrsCardRecord,
  SrsCardType,
  SrsReviewRecord,
  SrsSourceType,
} from '@loqua/db-postgres';

export type {
  ErrorEventRecord,
  RecordAttemptInput,
  SessionItemRecord,
  SessionRecord,
  SessionStore,
  SrsCardRecord,
  SrsReviewRecord,
} from '@loqua/db-postgres';

export class InMemorySessionRepository implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly items: SessionItemRecord[] = [];
  private readonly attempts: RecordAttemptInput['attempt'][] = [];
  private readonly skillStates = new Map<string, SkillStateRecord>();
  private readonly conceptStates = new Map<string, ConceptStateRecord>();
  private readonly cards = new Map<string, SrsCardRecord>();
  readonly errorEvents: RecordAttemptInput['errorEvent'][] = [];
  readonly reviews: SrsReviewRecord[] = [];

  async createSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.id, record);
  }

  async findActiveSession(userId: string, profileId: string): Promise<SessionRecord | null> {
    const matches = [...this.sessions.values()]
      .filter(
        (session) =>
          session.userId === userId &&
          session.profileId === profileId &&
          (session.status === 'planned' || session.status === 'in_progress') &&
          session.deletedAt === null,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }

  async getSession(userId: string, id: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(id);
    return session && session.userId === userId ? session : null;
  }

  async updateSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.id, record);
  }

  async listSessionItems(userId: string, sessionId: string): Promise<readonly SessionItemRecord[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return [];
    return this.items
      .filter((item) => item.sessionId === sessionId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  async addSessionItems(
    userId: string,
    sessionId: string,
    items: readonly SessionItemRecord[],
  ): Promise<readonly SessionItemRecord[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw new Error('session_not_found');
    const inserted: SessionItemRecord[] = [];
    for (const item of items) {
      if (
        this.items.some((entry) => entry.sessionId === sessionId && entry.itemId === item.itemId)
      ) {
        continue;
      }
      this.items.push(item);
      inserted.push(item);
    }
    return inserted;
  }

  async recordAttempt(input: RecordAttemptInput): Promise<void> {
    this.attempts.push(input.attempt);
    if (input.errorEvent) this.errorEvents.push(input.errorEvent);
    if (input.sessionItemId && input.sessionItemStatus) {
      const index = this.items.findIndex((item) => item.id === input.sessionItemId);
      const current = this.items[index];
      if (current) {
        this.items[index] = {
          ...current,
          status: input.sessionItemStatus,
          answeredAt: input.sessionItemAnsweredAt ?? input.attempt.createdAt,
        };
      }
    }
    if (input.skillState) {
      this.skillStates.set(
        `${input.skillState.userId}:${input.skillState.skillId}`,
        input.skillState,
      );
    }
    if (input.conceptState) {
      const { lastErrorAt: _lastErrorAt, ...concept } = input.conceptState;
      this.conceptStates.set(`${concept.userId}:${concept.conceptId}`, concept);
    }
    if (input.srsCard) {
      this.cards.set(input.srsCard.id, input.srsCard);
    }
    if (input.srsReview) {
      this.reviews.push(input.srsReview);
    }
  }

  async getSkillState(userId: string, skillId: string): Promise<SkillStateRecord | null> {
    return this.skillStates.get(`${userId}:${skillId}`) ?? null;
  }

  async getConceptState(userId: string, conceptId: string): Promise<ConceptStateRecord | null> {
    return this.conceptStates.get(`${userId}:${conceptId}`) ?? null;
  }

  async listConceptStates(userId: string): Promise<readonly ConceptStateRecord[]> {
    return [...this.conceptStates.values()].filter((state) => state.userId === userId);
  }

  async countErrorEvents(userId: string, errorType: string, since: string): Promise<number> {
    return this.errorEvents.filter(
      (event) =>
        event !== null &&
        event !== undefined &&
        event.userId === userId &&
        event.errorType === errorType &&
        event.createdAt >= since,
    ).length;
  }

  async findSrsCard(
    userId: string,
    profileId: string,
    sourceType: SrsSourceType,
    sourceId: string,
    cardType: SrsCardType,
  ): Promise<SrsCardRecord | null> {
    return (
      [...this.cards.values()].find(
        (card) =>
          card.userId === userId &&
          card.profileId === profileId &&
          card.sourceType === sourceType &&
          card.sourceId === sourceId &&
          card.cardType === cardType,
      ) ?? null
    );
  }

  async listDueSrsCards(
    userId: string,
    profileId: string,
    now: string | Date,
    limit: number,
  ): Promise<readonly SrsCardRecord[]> {
    const timestamp = now instanceof Date ? now.toISOString() : now;
    return [...this.cards.values()]
      .filter(
        (card) =>
          card.userId === userId &&
          card.profileId === profileId &&
          !card.suspended &&
          card.deletedAt === null &&
          card.dueAt <= timestamp,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, limit);
  }

  async upsertSrsCard(record: SrsCardRecord): Promise<SrsCardRecord> {
    this.cards.set(record.id, record);
    return record;
  }

  async recordSrsReview(record: SrsReviewRecord): Promise<void> {
    this.reviews.push(record);
  }
}
