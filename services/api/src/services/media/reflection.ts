import {
  mediaReflectInputSchema,
  mediaReflectionSchema,
  type MediaReflection,
} from '@loqua/ai';
import { RULES, getMediaTitle } from '@loqua/content';
import {
  canProcessAi,
  createSavedPhrase,
  createSrsCard,
  fallbackReflection,
  generateUuidV7,
} from '@loqua/core';

import {
  findApprovedTitle,
  MediaError,
  requireProfile,
  resolveLevel,
  type MediaServiceDeps,
} from './context.js';

export interface ReflectionInput {
  readonly text: string;
  readonly durationSec?: number;
  readonly phrases?: readonly string[];
}

export interface SavedPhraseSummary {
  readonly id: string;
  readonly text: string;
}

export interface ReflectionResult {
  readonly reflection: Record<string, unknown>;
  readonly savedPhrases: SavedPhraseSummary[];
  readonly xpAwarded: number;
}

export async function reflectOnMedia(
  deps: MediaServiceDeps,
  userId: string,
  mediaId: string,
  input: ReflectionInput,
): Promise<ReflectionResult> {
  const { profile, consents } = await requireProfile(deps, userId);
  const title = await findApprovedTitle(deps, profile.targetLang, mediaId);
  const catalog = getMediaTitle(mediaId);
  if (!catalog) {
    throw new MediaError(404, 'not_found', 'Media title not found');
  }

  const now = deps.now();
  const timestamp = now.toISOString();
  const level = await resolveLevel(deps, userId, profile);

  let reflection: Record<string, unknown>;
  let countsAsProduction: boolean;
  if (canProcessAi(consents)) {
    try {
      const ruleIds = RULES.filter((rule) =>
        rule.id.startsWith(`${profile.targetLang}.`),
      )
        .map((rule) => rule.id)
        .slice(0, 200);
      const response = await deps.ai.call({
        promptId: 'media.reflect',
        promptVersion: 1,
        tier: 'reason',
        input: mediaReflectInputSchema.parse({
          targetLang: profile.targetLang,
          nativeLang: profile.nativeLang,
          explanationMode: profile.explanationMode,
          learner: { level },
          media: { title: title.title, kind: catalog.kind },
          responseText: input.text,
          durationSec: input.durationSec,
          ruleIds,
        }),
        schema: mediaReflectionSchema,
        userId,
      });
      reflection = toJsonObject(response.data);
      countsAsProduction = response.data.countsAsProduction;
    } catch {
      const fallback = fallbackReflection(input.text, input.durationSec);
      reflection = toJsonObject(fallback);
      countsAsProduction = fallback.countsAsProduction;
    }
  } else {
    const fallback = fallbackReflection(input.text, input.durationSec);
    reflection = toJsonObject(fallback);
    countsAsProduction = fallback.countsAsProduction;
  }

  const savedPhrases: SavedPhraseSummary[] = [];
  for (const raw of input.phrases ?? []) {
    const text = raw.trim();
    if (text.length === 0) continue;

    const phrase = createSavedPhrase({
      id: generateUuidV7(),
      userId,
      profileId: profile.id,
      targetLang: profile.targetLang,
      text,
      source: 'media',
      sourceRef: mediaId,
      now,
    });
    const saved = await deps.account.upsertSavedPhrase(phrase);

    const card = createSrsCard({
      cardType: 'production',
      now,
      id: generateUuidV7(),
    });
    await deps.sessions.upsertSrsCard({
      id: card.id,
      userId,
      profileId: profile.id,
      cardType: 'production',
      sourceType: 'saved_phrase',
      sourceId: saved.id,
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
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });

    savedPhrases.push({ id: saved.id, text: saved.text });
  }

  let xpAwarded = 0;
  if (countsAsProduction) {
    await deps.sessions.addXpEvent({
      id: generateUuidV7(),
      userId,
      profileId: profile.id,
      amount: 25,
      reason: 'media_reflection',
      sourceType: 'media',
      sourceId: mediaId,
      createdAt: timestamp,
    });
    xpAwarded = 25;
  }

  return { reflection, savedPhrases, xpAwarded };
}

function toJsonObject(
  value: MediaReflection | ReturnType<typeof fallbackReflection>,
): Record<string, unknown> {
  return { ...value };
}
