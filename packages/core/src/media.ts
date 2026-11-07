import { z } from 'zod';

import { cefrLevelSchema } from './schemas.js';
import { cefrRank, isCefrLevel, type CefrLevel } from './skills.js';

export const MEDIA_KINDS = ['movie', 'series', 'book'] as const;
export const MEDIA_GENRES = [
  'comedy',
  'drama',
  'thriller',
  'sci_fi',
  'fantasy',
  'documentary',
  'romance',
  'crime',
  'biography',
  'business',
  'tech',
  'history',
  'sport',
] as const;
export const MEDIA_THEMES = [
  'work',
  'travel',
  'daily_life',
  'relationships',
  'humor',
  'mystery',
  'society',
  'science',
] as const;
export const DIFFICULTY_TOLERANCES = ['easy', 'balanced', 'challenging'] as const;
export const SUBTITLE_PREFS = ['target', 'native', 'both', 'none'] as const;
export const MEDIA_ACCENTS = ['us', 'uk', 'au', 'mixed'] as const;

export const mediaKindSchema = z.enum(MEDIA_KINDS);
export const mediaGenreSchema = z.enum(MEDIA_GENRES);
export const mediaThemeSchema = z.enum(MEDIA_THEMES);
export const difficultyToleranceSchema = z.enum(DIFFICULTY_TOLERANCES);
export const subtitlePrefSchema = z.enum(SUBTITLE_PREFS);
export const mediaAccentSchema = z.enum(MEDIA_ACCENTS);
export const mediaRegionSchema = z.string().regex(/^[A-Z]{2}$/);

const coverageValueSchema = z.number().min(0).max(1);
const tagsSchema = z.array(z.string().trim().min(1));

export const mediaCandidateSchema = z.object({
  id: z.string().trim().min(1),
  kind: mediaKindSchema,
  targetLang: z.string().trim().min(1),
  title: z.string().trim().min(1),
  difficultyBand: cefrLevelSchema,
  difficultyScore: z.number().min(0).max(1),
  coverage: z.partialRecord(cefrLevelSchema, coverageValueSchema),
  editorialQuality: z.number().int().min(1).max(5),
  languageVariety: z.string().trim().min(1).optional(),
  genres: tagsSchema,
  themes: tagsSchema,
  conceptTags: tagsSchema,
  durationMinutes: z.number().int().positive().optional(),
  episodeCount: z.number().int().positive().optional(),
  episodeMinutes: z.number().int().positive().optional(),
  pageCount: z.number().int().positive().optional(),
  ageRating: z.string().trim().min(1).optional(),
  contentWarnings: tagsSchema,
  availabilityRegions: z.array(mediaRegionSchema),
  availabilityProviders: tagsSchema,
  freshnessDays: z.number().int().nonnegative().optional(),
  franchise: z.string().trim().min(1).optional(),
});

export const tasteProfileSchema = z.object({
  formats: z.array(mediaKindSchema).min(1),
  genres: tagsSchema,
  themes: tagsSchema,
  disliked: tagsSchema,
  difficultyTolerance: difficultyToleranceSchema,
  subtitlePref: subtitlePrefSchema,
  accents: z.array(mediaAccentSchema),
  region: mediaRegionSchema,
  weeklyMinutes: z.number().int().min(30).max(900),
  maxAgeRating: z.string().trim().min(1).nullable().optional(),
  genreWeights: z.record(z.string().trim().min(1), coverageValueSchema).default({}),
  themeWeights: z.record(z.string().trim().min(1), coverageValueSchema).default({}),
  coverageOffset: z.number().min(-0.02).max(0.02).default(0),
});

export const recommendationHistorySchema = z.object({
  excludedIds: z.array(z.string().trim().min(1)),
  lastRecommendedIds: z.array(z.string().trim().min(1)),
  recentTags: z.array(
    z.object({
      genres: tagsSchema,
      themes: tagsSchema,
    }),
  ),
});

export const mediaFeedbackSchema = z.object({
  kind: z.enum(['accepted', 'rejected', 'started', 'finished', 'abandoned']),
  rating: z.number().int().min(1).max(5).optional(),
  difficulty: z.enum(['too_easy', 'ok', 'too_hard']).optional(),
  reasonCode: z.string().trim().min(1).optional(),
});

export const scoredRecommendationSchema = z.object({
  mediaId: z.string().trim().min(1),
  score: z.number().min(0).max(1),
  components: z.object({
    levelFit: z.number().min(0).max(1),
    tasteMatch: z.number().min(0).max(1),
    gapFit: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    diversity: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
  }),
  media: mediaCandidateSchema,
});

export type MediaKind = z.infer<typeof mediaKindSchema>;
export type MediaGenre = z.infer<typeof mediaGenreSchema>;
export type MediaTheme = z.infer<typeof mediaThemeSchema>;
export type DifficultyTolerance = z.infer<typeof difficultyToleranceSchema>;
export type SubtitlePref = z.infer<typeof subtitlePrefSchema>;
export type MediaAccent = z.infer<typeof mediaAccentSchema>;
export type MediaCandidate = z.infer<typeof mediaCandidateSchema>;
export type TasteProfile = z.infer<typeof tasteProfileSchema>;
export type RecommendationHistory = z.infer<typeof recommendationHistorySchema>;
export type MediaFeedback = z.infer<typeof mediaFeedbackSchema>;
export type ScoredRecommendation = z.infer<typeof scoredRecommendationSchema>;

export interface RankMediaRequest {
  readonly targetLang: string;
  readonly level: CefrLevel;
  readonly tastes: TasteProfile;
  readonly weakConcepts: readonly string[];
  readonly recentErrorTypes: readonly string[];
  readonly region: string;
  readonly weeklyMinutes: number;
  readonly history: RecommendationHistory;
  readonly limit: number;
  readonly seed?: number;
}

export interface MediaExplanation {
  readonly whyItFits: string;
  readonly levelNote: string;
  readonly approach: string;
  readonly phrasesToNotice: string[];
}

export interface MediaGuide {
  readonly mediaId: string;
  readonly before: string[];
  readonly during: string[];
  readonly after: string[];
  readonly targetConcepts: string[];
  readonly functionalPhrases: string[];
  readonly comprehensionPrompts: string[];
  readonly reflectionTask: string;
}

export interface ReflectionResult {
  readonly countsAsProduction: boolean;
  readonly praise: string;
  readonly nextFocus: string[];
}

const TARGET_COVERAGE: Record<DifficultyTolerance, number> = {
  easy: 0.96,
  balanced: 0.93,
  challenging: 0.9,
};

const TOLERANCE_ORDER = DIFFICULTY_TOLERANCES;

const FUNCTIONAL_PHRASES = [
  'Could you say that again more slowly?',
  'What does this word or phrase mean?',
  'In other words, ...',
  'I think that ...',
  'That reminds me of ...',
  'Could you give me an example?',
  'I agree, but I would add that ...',
  'Let me check that I understood correctly.',
];

export function targetCoverageFor(tolerance: DifficultyTolerance): number {
  return TARGET_COVERAGE[tolerance];
}

export function coverageForLevel(candidate: MediaCandidate, level: CefrLevel): number {
  const direct = candidate.coverage[level];
  if (direct !== undefined) return clamp(direct, 0, 1);

  const targetRank = cefrRank(level);
  let nearestLevel: CefrLevel | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const available of Object.keys(candidate.coverage)) {
    if (!isCefrLevel(available)) continue;
    const value = candidate.coverage[available];
    if (value === undefined) continue;
    const distance = Math.abs(cefrRank(available) - targetRank);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLevel = available;
    }
  }

  if (nearestLevel !== null) {
    return clamp(candidate.coverage[nearestLevel] ?? 0, 0, 1);
  }

  return clamp(0.95 - 0.1 * candidate.difficultyScore, 0, 1);
}

export function levelFitFor(
  candidate: MediaCandidate,
  level: CefrLevel,
  targetCoverage: number,
): number {
  const coverage = coverageForLevel(candidate, level);
  const delta = coverage - targetCoverage;
  return clamp(Math.exp(-(delta * delta) / (2 * 0.06 * 0.06)), 0, 1);
}

export function tasteMatchFor(candidate: MediaCandidate, tastes: TasteProfile): number {
  const genreWeights = new Map<string, number>();
  const themeWeights = new Map<string, number>();

  for (const [key, weight] of Object.entries(tastes.genreWeights)) {
    genreWeights.set(normalizeTag(key), clamp(weight, 0, 1));
  }
  for (const [key, weight] of Object.entries(tastes.themeWeights)) {
    themeWeights.set(normalizeTag(key), clamp(weight, 0, 1));
  }
  for (const genre of tastes.genres) {
    const key = normalizeTag(genre);
    if (!genreWeights.has(key)) genreWeights.set(key, 1);
  }
  for (const theme of tastes.themes) {
    const key = normalizeTag(theme);
    if (!themeWeights.has(key)) themeWeights.set(key, 1);
  }

  if (genreWeights.size === 0 && themeWeights.size === 0) return 0.5;

  const candidateTags = new Set<string>();
  for (const genre of candidate.genres) candidateTags.add(normalizeTag(genre));
  for (const theme of candidate.themes) candidateTags.add(normalizeTag(theme));
  if (candidateTags.size === 0) return 0.5;

  let dot = 0;
  for (const tag of candidateTags) {
    dot += genreWeights.get(tag) ?? themeWeights.get(tag) ?? 0;
  }

  let userSquared = 0;
  for (const weight of genreWeights.values()) userSquared += weight * weight;
  for (const weight of themeWeights.values()) userSquared += weight * weight;
  const userNorm = Math.sqrt(userSquared);
  if (userNorm === 0) return 0.5;

  const candidateNorm = Math.sqrt(candidateTags.size);
  return clamp(dot / (candidateNorm * userNorm), 0, 1);
}

export function gapFitFor(
  candidate: MediaCandidate,
  weakConcepts: readonly string[],
  recentErrorTypes: readonly string[],
): number {
  const signals = new Set<string>();
  const weak = weakConcepts.map((value) => value.trim()).filter((value) => value.length > 0);
  const errors = recentErrorTypes.map((value) => value.trim()).filter((value) => value.length > 0);
  for (const value of weak) signals.add(`concept:${normalizeTag(value)}`);
  for (const value of errors) signals.add(`error:${normalizeTag(value)}`);
  if (signals.size === 0) return 0;

  const conceptTags = candidate.conceptTags.map((tag) => normalizeTag(tag));
  let matched = 0;

  for (const weakConcept of weak) {
    const target = normalizeTag(weakConcept);
    if (conceptTags.some((tag) => tag === target)) matched += 1;
  }

  for (const errorType of errors) {
    const target = normalizeTag(errorType);
    if (conceptTags.some((tag) => tag.split('.').includes(target))) matched += 1;
  }

  return clamp(matched / signals.size, 0, 1);
}

export function diversityFor(
  candidate: MediaCandidate,
  recentTags: ReadonlyArray<{ genres: string[]; themes: string[] }>,
): number {
  if (recentTags.length === 0) return 1;
  const candidateTags = mediaTagSet(candidate);
  if (candidateTags.size === 0) return 1;

  let maximumSimilarity = 0;
  for (const recent of recentTags) {
    const recentSet = new Set<string>();
    for (const genre of recent.genres) recentSet.add(normalizeTag(genre));
    for (const theme of recent.themes) recentSet.add(normalizeTag(theme));

    let intersection = 0;
    for (const tag of candidateTags) {
      if (recentSet.has(tag)) intersection += 1;
    }
    const union = candidateTags.size + recentSet.size - intersection;
    const similarity = union === 0 ? 0 : intersection / union;
    if (similarity > maximumSimilarity) maximumSimilarity = similarity;
  }

  return clamp(1 - maximumSimilarity, 0, 1);
}

export function freshnessFor(candidate: MediaCandidate): number {
  if (candidate.freshnessDays === undefined) return 1;
  return candidate.freshnessDays <= 90 ? 1 : 0.5;
}

export function isEligible(candidate: MediaCandidate, request: RankMediaRequest): boolean {
  const tastes = request.tastes;

  if (normalizeTag(candidate.targetLang) !== normalizeTag(request.targetLang)) return false;
  if (!tastes.formats.includes(candidate.kind)) return false;

  const region = request.region.trim().toUpperCase();
  if (!candidate.availabilityRegions.some((value) => value.toUpperCase() === region)) {
    return false;
  }

  const disliked = new Set(tastes.disliked.map(normalizeTag));
  if (candidate.genres.some((genre) => disliked.has(normalizeTag(genre)))) return false;
  if (candidate.themes.some((theme) => disliked.has(normalizeTag(theme)))) return false;

  if (request.history.excludedIds.includes(candidate.id)) return false;

  if (!ageRatingAllowed(candidate.ageRating, tastes.maxAgeRating)) return false;

  const weeklyMinutes = request.weeklyMinutes;
  if (candidate.kind === 'movie' && candidate.durationMinutes !== undefined) {
    if (candidate.durationMinutes > weeklyMinutes * 2) return false;
  }
  if (candidate.kind === 'series' && candidate.episodeMinutes !== undefined) {
    if (candidate.episodeMinutes > weeklyMinutes) return false;
  }
  if (candidate.kind === 'book' && candidate.pageCount !== undefined) {
    if (candidate.pageCount > weeklyMinutes * 4) return false;
  }

  return true;
}

export function rankMedia(
  candidates: readonly MediaCandidate[],
  request: RankMediaRequest,
): ScoredRecommendation[] {
  const targetCoverage = clamp(
    targetCoverageFor(request.tastes.difficultyTolerance) + (request.tastes.coverageOffset ?? 0),
    0,
    1,
  );

  const scored = candidates
    .filter((candidate) => isEligible(candidate, request))
    .map((candidate) => {
      const levelFit = levelFitFor(candidate, request.level, targetCoverage);
      const tasteMatch = tasteMatchFor(candidate, request.tastes);
      const gapFit = gapFitFor(candidate, request.weakConcepts, request.recentErrorTypes);
      const quality = clamp(candidate.editorialQuality / 5, 0, 1);
      const diversity = diversityFor(candidate, request.history.recentTags);
      const freshness = freshnessFor(candidate);
      const score = clamp(
        0.35 * levelFit +
          0.25 * tasteMatch +
          0.15 * gapFit +
          0.1 * quality +
          0.1 * diversity +
          0.05 * freshness,
        0,
        1,
      );

      return {
        mediaId: candidate.id,
        score,
        components: { levelFit, tasteMatch, gapFit, quality, diversity, freshness },
        media: candidate,
      };
    })
    .sort(compareScored);

  const limit = Math.max(0, Math.floor(request.limit));
  if (limit === 0) return [];

  const selected: ScoredRecommendation[] = [];
  const genreCounts = new Map<string, number>();
  const franchises = new Set<string>();

  for (const item of scored) {
    if (selected.length >= limit) break;

    const genres = item.media.genres.map(normalizeTag);
    const franchise = item.media.franchise ? normalizeTag(item.media.franchise) : null;

    if (selected.length < 5) {
      const genreBlocked = genres.some((genre) => (genreCounts.get(genre) ?? 0) >= 2);
      const franchiseBlocked = franchise !== null && franchises.has(franchise);
      if (genreBlocked || franchiseBlocked) continue;
    }

    selected.push(item);
    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    if (franchise !== null) franchises.add(franchise);
  }

  if (selected.length >= 4) {
    const selectedIds = new Set(selected.map((item) => item.media.id));
    const selectedGenres = new Set(selected.flatMap((item) => item.media.genres.map(normalizeTag)));
    if (selectedGenres.size < 4) {
      const selectedFranchises = new Set(
        selected.flatMap((item) =>
          item.media.franchise ? [normalizeTag(item.media.franchise)] : [],
        ),
      );
      const replacement = scored.find((item) => {
        if (selectedIds.has(item.media.id)) return false;
        if (item.media.franchise && selectedFranchises.has(normalizeTag(item.media.franchise))) {
          return false;
        }
        return item.media.genres.some((genre) => !selectedGenres.has(normalizeTag(genre)));
      });
      if (replacement) {
        selected[selected.length - 1] = replacement;
      }
    }
  }

  if (request.seed !== undefined && request.seed % 10 === 0 && selected.length > 0) {
    const selectedIds = new Set(selected.map((item) => item.media.id));
    const selectedGenres = new Set<string>();
    for (const item of selected.slice(0, 5)) {
      for (const genre of item.media.genres) selectedGenres.add(normalizeTag(genre));
    }
    const selectedFranchises = new Set<string>();
    for (const item of selected) {
      if (item.media.franchise) selectedFranchises.add(normalizeTag(item.media.franchise));
    }

    const replacement = scored.find((item) => {
      if (selectedIds.has(item.media.id)) return false;
      if (item.media.genres.some((genre) => selectedGenres.has(normalizeTag(genre)))) {
        return false;
      }
      if (item.media.franchise && selectedFranchises.has(normalizeTag(item.media.franchise))) {
        return false;
      }
      return true;
    });

    if (replacement) selected[selected.length - 1] = replacement;
  }

  return selected;
}

export function updateTaste(
  tastes: TasteProfile,
  feedback: MediaFeedback,
  candidate: MediaCandidate,
): TasteProfile {
  const next: TasteProfile = {
    ...tastes,
    formats: [...tastes.formats],
    genres: [...tastes.genres],
    themes: [...tastes.themes],
    disliked: [...tastes.disliked],
    accents: [...tastes.accents],
    genreWeights: { ...tastes.genreWeights },
    themeWeights: { ...tastes.themeWeights },
    coverageOffset: tastes.coverageOffset ?? 0,
  };

  const baseDelta =
    feedback.kind === 'accepted' || feedback.kind === 'finished'
      ? 0.08
      : feedback.kind === 'rejected'
        ? -0.15
        : 0;
  const ratingDelta = feedback.rating === undefined ? 0 : ((feedback.rating - 3) / 2) * 0.08;
  const totalDelta = baseDelta + ratingDelta;

  if (totalDelta !== 0) {
    for (const genre of candidate.genres) {
      const key = normalizeTag(genre);
      const current = currentWeight(next.genreWeights, key, next.genres);
      next.genreWeights[key] = clamp(current + totalDelta, 0, 1);
    }
    for (const theme of candidate.themes) {
      const key = normalizeTag(theme);
      const current = currentWeight(next.themeWeights, key, next.themes);
      next.themeWeights[key] = clamp(current + totalDelta, 0, 1);
    }
  }

  if (feedback.difficulty === 'too_hard') {
    next.difficultyTolerance = stepTolerance(next.difficultyTolerance, -1);
    next.coverageOffset = clamp(next.coverageOffset - 0.02, -0.02, 0.02);
  } else if (feedback.difficulty === 'too_easy') {
    next.difficultyTolerance = stepTolerance(next.difficultyTolerance, 1);
    next.coverageOffset = clamp(next.coverageOffset + 0.02, -0.02, 0.02);
  }

  return tasteProfileSchema.parse(next);
}

export function decayTaste(tastes: TasteProfile, factor = 0.95): TasteProfile {
  const genreWeights: Record<string, number> = {};
  const themeWeights: Record<string, number> = {};
  let maximum = 0;

  for (const [key, weight] of Object.entries(tastes.genreWeights)) {
    const value = clamp(weight * factor, 0, 1);
    genreWeights[key] = value;
    if (value > maximum) maximum = value;
  }
  for (const [key, weight] of Object.entries(tastes.themeWeights)) {
    const value = clamp(weight * factor, 0, 1);
    themeWeights[key] = value;
    if (value > maximum) maximum = value;
  }

  if (maximum > 0 && maximum !== 1) {
    for (const key of Object.keys(genreWeights)) {
      genreWeights[key] = clamp((genreWeights[key] ?? 0) / maximum, 0, 1);
    }
    for (const key of Object.keys(themeWeights)) {
      themeWeights[key] = clamp((themeWeights[key] ?? 0) / maximum, 0, 1);
    }
  }

  return tasteProfileSchema.parse({
    ...tastes,
    formats: [...tastes.formats],
    genres: [...tastes.genres],
    themes: [...tastes.themes],
    disliked: [...tastes.disliked],
    accents: [...tastes.accents],
    genreWeights,
    themeWeights,
  });
}

export function deterministicExplanation(
  candidate: MediaCandidate,
  request: RankMediaRequest,
): MediaExplanation {
  const coverage = coverageForLevel(candidate, request.level);
  const percentage = Math.round(coverage * 100);
  const genres = candidate.genres.slice(0, 2);
  const themes = candidate.themes.slice(0, 2);
  const interestParts = [...genres, ...themes];

  const whyItFits =
    interestParts.length > 0
      ? `This ${candidate.kind} matches your level and your interest in ${interestParts.join(
          ', ',
        )}. It keeps the language demand close to your target, so you can enjoy it without stopping constantly.`
      : `This ${candidate.kind} matches your level and keeps the language demand close to your target, so you can enjoy it without stopping constantly.`;

  const levelNote = `About ${percentage}% of the words are estimated to be at your ${request.level} level.`;

  const approach = approachForSubtitlePref(request.tastes.subtitlePref);

  return {
    whyItFits,
    levelNote,
    approach,
    phrasesToNotice: FUNCTIONAL_PHRASES.slice(0, 5),
  };
}

export function fallbackGuide(
  candidate: MediaCandidate,
  targetConcepts: readonly string[],
): MediaGuide {
  return {
    mediaId: candidate.id,
    before: [
      'Preview three or four useful words or phrases before you start.',
      'Set a realistic time limit for this session.',
      'Choose the subtitle or support option that matches your plan.',
    ],
    during: [
      'Pause after short sections and note one phrase you want to remember.',
      'Focus on the general meaning before checking individual words.',
      'Write down questions to review after the session.',
    ],
    after: [
      'Summarize the main idea in your own words.',
      'Review the phrases you noted and add them to your review deck.',
      'Say or write what you understood without looking back.',
    ],
    targetConcepts: targetConcepts.slice(0, 3),
    functionalPhrases: FUNCTIONAL_PHRASES.slice(0, 8),
    comprehensionPrompts: [
      'What was the main topic?',
      'Which words or phrases helped you follow the meaning?',
      'What part was easiest to understand, and why?',
      'What would you like to understand better next time?',
    ],
    reflectionTask:
      'Speak for 60 seconds or write at least 80 words about what you understood and which phrases you want to reuse.',
  };
}

export function fallbackReflection(text: string, durationSec?: number): ReflectionResult {
  const trimmed = text.trim();
  const countsAsProduction = trimmed.length >= 80 || (durationSec ?? 0) >= 60;

  return {
    countsAsProduction,
    praise: countsAsProduction
      ? 'You produced enough language for this to count as a production step.'
      : 'You made a start. A little more detail next time will turn this into a production step.',
    nextFocus: countsAsProduction
      ? ['Reuse two phrases you noticed.', 'Add one reason or example.']
      : [
          'Speak for 60 seconds or write at least 80 characters.',
          'Use one new phrase from the title.',
        ],
  };
}

export function defaultTasteProfile(region = 'IT'): TasteProfile {
  const normalizedRegion = region.trim().toUpperCase();
  const safeRegion = /^[A-Z]{2}$/.test(normalizedRegion) ? normalizedRegion : 'IT';

  return tasteProfileSchema.parse({
    formats: ['movie', 'series', 'book'],
    genres: [],
    themes: [],
    disliked: [],
    difficultyTolerance: 'balanced',
    subtitlePref: 'target',
    accents: ['mixed'],
    region: safeRegion,
    weeklyMinutes: 120,
    maxAgeRating: null,
    genreWeights: {},
    themeWeights: {},
    coverageOffset: 0,
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function mediaTagSet(candidate: MediaCandidate): Set<string> {
  const tags = new Set<string>();
  for (const genre of candidate.genres) tags.add(normalizeTag(genre));
  for (const theme of candidate.themes) tags.add(normalizeTag(theme));
  return tags;
}

function compareScored(first: ScoredRecommendation, second: ScoredRecommendation): number {
  if (first.score !== second.score) return second.score - first.score;
  if (first.media.title !== second.media.title) {
    return first.media.title < second.media.title ? -1 : 1;
  }
  if (first.media.id !== second.media.id) return first.media.id < second.media.id ? -1 : 1;
  return 0;
}

function currentWeight(
  weights: Record<string, number>,
  key: string,
  selected: readonly string[],
): number {
  const stored = weights[key];
  if (stored !== undefined) return stored;
  return selected.some((value) => normalizeTag(value) === key) ? 1 : 0;
}

function stepTolerance(tolerance: DifficultyTolerance, direction: -1 | 1): DifficultyTolerance {
  const index = TOLERANCE_ORDER.indexOf(tolerance);
  const nextIndex = clamp(index + direction, 0, TOLERANCE_ORDER.length - 1);
  return TOLERANCE_ORDER[nextIndex] ?? tolerance;
}

function approachForSubtitlePref(pref: SubtitlePref): string {
  switch (pref) {
    case 'target':
      return 'Use target-language subtitles and pause after short sections to note useful phrases.';
    case 'native':
      return 'Use native-language subtitles for support, then rewatch short sections without them.';
    case 'both':
      return 'Start with both subtitle tracks, then switch to target-language subtitles for short sections.';
    case 'none':
      return 'Watch or read without subtitles, pausing when the meaning is unclear.';
  }
}

function ageRatingAllowed(
  candidateRating: string | undefined,
  maximumRating: string | null | undefined,
): boolean {
  if (candidateRating === undefined) return true;
  if (maximumRating === null || maximumRating === undefined) return true;

  const candidateAge = parseAgeRating(candidateRating);
  if (candidateAge === null) return true;

  const maximumAge = parseAgeRating(maximumRating);
  if (maximumAge === null) return false;

  return candidateAge <= maximumAge;
}

function parseAgeRating(rating: string): number | null {
  const normalized = rating.trim().toUpperCase().replace(/\s+/g, '');

  switch (normalized) {
    case 'G':
    case 'U':
    case 'TV-G':
    case 'TV-Y':
      return 0;
    case 'TV-Y7':
    case 'PG':
    case 'TV-PG':
      return 7;
    case 'PG-13':
    case '12':
    case '12A':
      return normalized === 'PG-13' ? 13 : 12;
    case '14':
    case 'TV-14':
      return 14;
    case '15':
      return 15;
    case '16':
      return 16;
    case 'R':
    case '17':
      return 17;
    case 'NC-17':
    case 'X':
    case '18':
    case 'TV-MA':
    case 'MA':
      return 18;
    case 'NR':
    case 'UNRATED':
      return null;
    default: {
      const match = /^(\d{1,2})/.exec(normalized);
      return match ? Number.parseInt(match[1] ?? '', 10) : null;
    }
  }
}
