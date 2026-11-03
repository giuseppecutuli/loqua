import { srsCardSchema, type SrsCard } from '@loqua/core';

import type { SrsCardRecord } from '../../repos/session.js';

export function toCoreCard(record: SrsCardRecord): SrsCard | null {
  const parsed = srsCardSchema.safeParse(record.fsrs);
  return parsed.success ? parsed.data : null;
}

export function toSrsCardRecord(
  card: SrsCard,
  userId: string,
  profileId: string,
  itemId: string,
  cardType: 'recognition' | 'production',
  now: string,
  createdAt: string,
): SrsCardRecord {
  return {
    id: card.id,
    userId,
    profileId,
    cardType,
    sourceType: 'item',
    sourceId: itemId,
    fsrs: { ...card },
    dueAt: card.dueAt,
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    suspended: card.suspended,
    leech: card.leech,
    lastReviewAt: card.lastReviewAt,
    createdAt,
    updatedAt: now,
    deletedAt: null,
  };
}
