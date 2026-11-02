import { z } from 'zod';

export const SAVED_PHRASE_SOURCES = ['exercise', 'conversation', 'media', 'manual'] as const;

export type SavedPhraseSource = (typeof SAVED_PHRASE_SOURCES)[number];

export const savedPhraseSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  profileId: z.string().min(1),
  targetLang: z.string().min(2),
  text: z.string().min(1).max(500),
  normalizedText: z.string().min(1).max(500),
  source: z.enum(SAVED_PHRASE_SOURCES),
  sourceRef: z.string().min(1).max(120).nullable(),
  note: z.string().max(500).nullable(),
  createdAt: z.iso.datetime({ offset: false }),
  deletedAt: z.iso.datetime({ offset: false }).nullable(),
});

export type SavedPhrase = z.infer<typeof savedPhraseSchema>;

export function normalizePhrase(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ');
}

export interface CreateSavedPhraseInput {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly targetLang: string;
  readonly text: string;
  readonly source: SavedPhraseSource;
  readonly sourceRef?: string | null;
  readonly note?: string | null;
  readonly now: Date;
}

export function createSavedPhrase(input: CreateSavedPhraseInput): SavedPhrase {
  const text = input.text.trim();
  return {
    id: input.id,
    userId: input.userId,
    profileId: input.profileId,
    targetLang: input.targetLang,
    text,
    normalizedText: normalizePhrase(text),
    source: input.source,
    sourceRef: input.sourceRef ?? null,
    note: input.note ?? null,
    createdAt: input.now.toISOString(),
    deletedAt: null,
  };
}
