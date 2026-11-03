import {
  mediaGuideInputSchema,
  mediaGuideSchema,
  type MediaGuide,
} from '@loqua/ai';
import {
  canProcessAi,
  coverageForLevel,
  defaultTasteProfile,
  fallbackGuide,
  generateUuidV7,
} from '@loqua/core';
import { getMediaTitle } from '@loqua/content';

import type {
  MediaProgressRecord,
  MediaProgressStatus,
} from '../../repos/media.js';
import {
  buildCandidate,
  buildTargetConcepts,
  findApprovedTitle,
  FUNCTIONAL_PHRASES,
  GUIDE_FALLBACK_PROMPT_ID,
  GUIDE_PROMPT_ID,
  MediaError,
  requireAvailability,
  requireProfile,
  resolveLevel,
  toTaste,
  type MediaServiceDeps,
} from './context.js';

export interface GuideResult {
  readonly guide: Record<string, unknown>;
  readonly source: 'llm' | 'rule';
  readonly progress: MediaProgressRecord;
}

export async function startGuide(
  deps: MediaServiceDeps,
  userId: string,
  mediaId: string,
): Promise<GuideResult> {
  const { profile, consents } = await requireProfile(deps, userId);
  const title = await findApprovedTitle(deps, profile.targetLang, mediaId);
  const catalog = getMediaTitle(mediaId);
  if (!catalog) {
    throw new MediaError(404, 'not_found', 'Media title not found');
  }

  const tasteRecord = await deps.media.getTasteProfile(profile.id);
  const taste = tasteRecord ? toTaste(tasteRecord) : defaultTasteProfile('IT');
  const region = tasteRecord?.region ?? taste.region;
  const rows = await requireAvailability(deps, mediaId, region);
  const candidate = buildCandidate(title, rows, region, deps.now());
  if (!candidate) {
    throw new MediaError(500, 'media_candidate_unavailable', 'Media candidate unavailable');
  }

  const now = deps.now();
  const timestamp = now.toISOString();
  const existing = await deps.media.getMediaProgress(profile.id, mediaId);
  const status: MediaProgressStatus = candidate.kind === 'book' ? 'reading' : 'watching';
  const progress: MediaProgressRecord = {
    id: existing?.id ?? generateUuidV7(),
    userId,
    profileId: profile.id,
    mediaId,
    status,
    progressPct: 0,
    startedAt: timestamp,
    finishedAt: null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await deps.media.upsertMediaProgress(progress);

  const level = await resolveLevel(deps, userId, profile);
  const cached = await deps.media.getMediaGuide(mediaId, profile.id, level, 1);
  if (cached) {
    return {
      guide: cached.guideJson,
      source: cached.promptId === GUIDE_FALLBACK_PROMPT_ID ? 'rule' : 'llm',
      progress,
    };
  }

  const targetConcepts = buildTargetConcepts(catalog);
  const conceptCodes = targetConcepts.map((concept) => concept.code);
  const synopsis = catalog.synopsis.slice(0, 600);

  let guide: Record<string, unknown>;
  let source: 'llm' | 'rule';
  if (canProcessAi(consents)) {
    try {
      const response = await deps.ai.call({
        promptId: GUIDE_PROMPT_ID,
        promptVersion: 1,
        tier: 'balanced',
        input: mediaGuideInputSchema.parse({
          targetLang: profile.targetLang,
          nativeLang: profile.nativeLang,
          uiLocale: profile.uiLocale,
          explanationMode: profile.explanationMode,
          learner: { level, weeklyMinutes: taste.weeklyMinutes },
          media: {
            id: candidate.id,
            kind: candidate.kind,
            title: candidate.title,
            synopsis,
            difficultyBand: candidate.difficultyBand,
            coverage: coverageForLevel(candidate, level),
            durationMinutes: candidate.durationMinutes,
            episodeCount: candidate.episodeCount,
            pageCount: candidate.pageCount,
          },
          targetConcepts,
          functionalPhrases: [...FUNCTIONAL_PHRASES],
        }),
        schema: mediaGuideSchema,
        userId,
      });
      guide = toJsonObject(response.data);
      source = 'llm';
    } catch {
      guide = toJsonObject(fallbackGuide(candidate, conceptCodes));
      source = 'rule';
    }
  } else {
    guide = toJsonObject(fallbackGuide(candidate, conceptCodes));
    source = 'rule';
  }

  await deps.media.upsertMediaGuide({
    id: generateUuidV7(),
    mediaId,
    profileId: profile.id,
    cefrLevel: level,
    guideJson: guide,
    promptId: source === 'llm' ? GUIDE_PROMPT_ID : GUIDE_FALLBACK_PROMPT_ID,
    promptVersion: 1,
    createdAt: timestamp,
  });

  return { guide, source, progress };
}

function toJsonObject(value: MediaGuide | ReturnType<typeof fallbackGuide>): Record<string, unknown> {
  return { ...value };
}
