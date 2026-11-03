import {
  mediaExplainInputSchema,
  mediaExplanationSchema,
  type MediaExplanation,
} from '@loqua/ai';
import {
  canProcessAi,
  coverageForLevel,
  defaultTasteProfile,
  type RankMediaRequest,
} from '@loqua/core';
import { getMediaTitle } from '@loqua/content';

import {
  buildCandidate,
  fallbackExplanation,
  findApprovedTitle,
  loadWeakConcepts,
  MediaError,
  requireAvailability,
  requireProfile,
  resolveLevel,
  toTaste,
  type ExplanationPayload,
  type MediaServiceDeps,
} from './context.js';

export interface ExplanationResult {
  readonly explanation: ExplanationPayload | MediaExplanation;
  readonly source: 'llm' | 'rule';
}

export async function explainMedia(
  deps: MediaServiceDeps,
  userId: string,
  mediaId: string,
): Promise<ExplanationResult> {
  const { profile, consents } = await requireProfile(deps, userId);
  const title = await findApprovedTitle(deps, profile.targetLang, mediaId);
  const tasteRecord = await deps.media.getTasteProfile(profile.id);
  const taste = tasteRecord ? toTaste(tasteRecord) : defaultTasteProfile('IT');
  const region = tasteRecord?.region ?? taste.region;
  const rows = await requireAvailability(deps, mediaId, region);
  const candidate = buildCandidate(title, rows, region, deps.now());
  if (!candidate) {
    throw new MediaError(500, 'media_candidate_unavailable', 'Media candidate unavailable');
  }

  const level = await resolveLevel(deps, userId, profile);
  const { weakConcepts, recentErrorTypes } = await loadWeakConcepts(deps, userId);
  const request: RankMediaRequest = {
    targetLang: profile.targetLang,
    level,
    tastes: taste,
    weakConcepts,
    recentErrorTypes,
    region,
    weeklyMinutes: taste.weeklyMinutes,
    history: { excludedIds: [], lastRecommendedIds: [], recentTags: [] },
    limit: 1,
  };

  if (!canProcessAi(consents)) {
    return { explanation: fallbackExplanation(candidate, request), source: 'rule' };
  }

  const catalog = getMediaTitle(mediaId);
  const synopsis = catalog?.synopsis ?? title.synopsisNative ?? title.title;

  try {
    const response = await deps.ai.call({
      promptId: 'media.explain',
      promptVersion: 1,
      tier: 'fast',
      input: mediaExplainInputSchema.parse({
        targetLang: profile.targetLang,
        nativeLang: profile.nativeLang,
        uiLocale: profile.uiLocale,
        explanationMode: profile.explanationMode,
        learner: {
          level,
          difficultyTolerance: taste.difficultyTolerance,
          interests: [...profile.interests].slice(0, 30),
          weeklyMinutes: taste.weeklyMinutes,
          weakConcepts: weakConcepts.slice(0, 30),
          recentErrorTypes: recentErrorTypes.slice(0, 30),
        },
        candidate: {
          id: candidate.id,
          kind: candidate.kind,
          title: candidate.title,
          originalTitle: catalog?.originalTitle,
          year: catalog?.releaseYear ?? title.releaseYear ?? undefined,
          synopsis: synopsis.slice(0, 600),
          genres: candidate.genres.slice(0, 20),
          themes: candidate.themes.slice(0, 20),
          difficultyBand: candidate.difficultyBand,
          coverage: coverageForLevel(candidate, level),
          durationMinutes: candidate.durationMinutes,
          episodeCount: candidate.episodeCount,
          pageCount: candidate.pageCount,
          ageRating: candidate.ageRating,
          contentWarnings: candidate.contentWarnings.slice(0, 20),
          availabilityProviders: candidate.availabilityProviders.slice(0, 20),
        },
        constraints: { noSpoilers: true, legalOnly: true },
      }),
      schema: mediaExplanationSchema,
      userId,
    });
    return { explanation: response.data, source: 'llm' };
  } catch {
    return { explanation: fallbackExplanation(candidate, request), source: 'rule' };
  }
}
