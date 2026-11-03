import { ALL_CONCEPTS, getMediaTitle, type MediaCatalogEntry } from '@loqua/content';
import {
  defaultTasteProfile,
  deterministicExplanation,
  isCefrLevel,
  tasteProfileSchema,
  type CefrLevel,
  type LearnerProfile,
  type MediaCandidate,
  type MediaKind,
  type RecommendationHistory,
  type TasteProfile,
} from '@loqua/core';
import type { AiGateway } from '@loqua/ai';

import type { AccountRepository } from '../../repos/account.js';
import type { AssessmentStore } from '../../repos/assessment.js';
import type {
  MediaAvailabilityRecord,
  MediaStore,
  MediaTitleRecord,
  RecommendationRecord,
  TasteProfileRecord,
} from '../../repos/media.js';
import type { SessionStore } from '../../repos/session.js';

export type MediaErrorStatus = 400 | 403 | 404 | 409 | 422 | 429 | 500;

export class MediaError extends Error {
  constructor(
    readonly status: MediaErrorStatus,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}

export interface MediaServiceDeps {
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly media: MediaStore;
  readonly now: () => Date;
}

export interface LoadedProfile {
  readonly profile: LearnerProfile;
  readonly consents: Awaited<ReturnType<AccountRepository['getSnapshot']>>['consents'];
}

export type DeterministicExplanation = ReturnType<typeof deterministicExplanation>;

export type ExplanationPayload = DeterministicExplanation & {
  readonly mediaId: string;
  readonly spoilerFree: true;
};

export const GUIDE_PROMPT_ID = 'media.guide';
export const GUIDE_FALLBACK_PROMPT_ID = 'media.guide.fallback';

export const FUNCTIONAL_PHRASES: readonly string[] = [
  'Could you say that again more slowly?',
  'What does this word or phrase mean?',
  'In other words, ...',
  'I think that ...',
  'That reminds me of ...',
  'Could you give me an example?',
  'I agree, but I would add that ...',
  'Let me check that I understood correctly.',
];

export async function requireProfile(
  deps: MediaServiceDeps,
  userId: string,
): Promise<LoadedProfile> {
  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    throw new MediaError(409, 'profile_required', 'Complete onboarding first');
  }
  return { profile: snapshot.profile, consents: snapshot.consents };
}

export async function resolveLevel(
  deps: MediaServiceDeps,
  userId: string,
  profile: LearnerProfile,
): Promise<CefrLevel> {
  if (isCefrLevel(profile.proficiencyEstimate)) return profile.proficiencyEstimate;
  const progress = await deps.assessments.getProgress(userId, profile.id);
  const latest = progress.latest?.overallLevel;
  return isCefrLevel(latest) ? latest : 'A1';
}

export function toTaste(record: TasteProfileRecord): TasteProfile {
  const parsed = tasteProfileSchema.safeParse({
    formats: record.formats,
    genres: record.genres,
    themes: record.themes,
    disliked: record.disliked,
    difficultyTolerance: record.difficultyTolerance,
    subtitlePref: record.subtitlePref,
    accents: record.accents,
    region: record.region,
    weeklyMinutes: record.weeklyMinutes,
    maxAgeRating: record.maxAgeRating,
    genreWeights: record.genreWeights,
    themeWeights: record.themeWeights,
    coverageOffset: record.coverageOffset,
  });
  if (parsed.success) return parsed.data;
  return defaultTasteProfile(record.region);
}

export async function findApprovedTitle(
  deps: MediaServiceDeps,
  targetLang: string,
  mediaId: string,
): Promise<MediaTitleRecord> {
  const titles = await deps.media.listApprovedTitles(targetLang);
  const title = titles.find((entry) => entry.id === mediaId);
  if (!title) {
    throw new MediaError(404, 'not_found', 'Media title not found');
  }
  return title;
}

export async function requireAvailability(
  deps: MediaServiceDeps,
  mediaId: string,
  region: string,
): Promise<readonly MediaAvailabilityRecord[]> {
  const rows = await deps.media.listAvailability([mediaId], region);
  if (rows.length === 0) {
    throw new MediaError(409, 'media_unavailable', 'No legal availability in this region');
  }
  return rows;
}

export function buildCandidate(
  title: MediaTitleRecord,
  rows: readonly MediaAvailabilityRecord[],
  region: string,
  now: Date,
): MediaCandidate | null {
  const kind = toMediaKind(title.kind);
  if (kind === null) return null;
  const catalog = getMediaTitle(title.id);
  return toCandidate(title, catalog, rows, region, now, kind);
}

export function catalogCandidate(
  entry: MediaCatalogEntry,
  rows: readonly MediaAvailabilityRecord[],
  region: string,
  now: Date,
): MediaCandidate {
  return toCandidate(
    {
      id: entry.id,
      kind: entry.kind,
      targetLang: entry.targetLang,
      title: entry.title,
      originalTitle: entry.originalTitle ?? null,
      releaseYear: entry.releaseYear,
      synopsisNative: entry.synopsis,
      difficultyBand: entry.difficultyBand,
      difficultyScore: entry.difficultyScore,
      coverage: entry.coverage,
      editorialQuality: entry.editorialQuality,
      languageVariety: entry.languageVariety ?? null,
      subtitleAvailability: [...entry.subtitleAvailability],
      speechRateWpm: null,
      durationMinutes: entry.durationMinutes ?? null,
      episodeCount: entry.episodeCount ?? null,
      episodeMinutes: entry.episodeMinutes ?? null,
      pageCount: entry.pageCount ?? null,
      ageRating: entry.ageRating ?? null,
      contentWarnings: [...entry.contentWarnings],
      genres: [...entry.genres],
      themes: [...entry.themes],
      externalIds: {},
      coverRef: null,
      licenseNote: entry.licenseNote,
      reviewStatus: entry.reviewStatus,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    entry,
    rows,
    region,
    now,
    entry.kind,
  );
}

function toCandidate(
  title: MediaTitleRecord,
  catalog: MediaCatalogEntry | undefined,
  rows: readonly MediaAvailabilityRecord[],
  region: string,
  now: Date,
  kind: MediaKind,
): MediaCandidate {
  const coverage: Partial<Record<CefrLevel, number>> = {};
  for (const [key, value] of Object.entries(title.coverage)) {
    if (isCefrLevel(key) && typeof value === 'number') {
      coverage[key] = clamp(value, 0, 1);
    }
  }

  const difficultyBand = isCefrLevel(title.difficultyBand)
    ? title.difficultyBand
    : (catalog?.difficultyBand ?? 'A1');
  const difficultyScore = clamp(title.difficultyScore ?? catalog?.difficultyScore ?? 0.5, 0, 1);
  const genres = title.genres.length > 0 ? title.genres : (catalog?.genres ?? []);
  const themes = title.themes.length > 0 ? title.themes : (catalog?.themes ?? []);
  const contentWarnings =
    title.contentWarnings.length > 0
      ? title.contentWarnings
      : (catalog?.contentWarnings ?? []);

  const candidate: MediaCandidate = {
    id: title.id,
    kind,
    targetLang: title.targetLang,
    title: title.title,
    difficultyBand,
    difficultyScore,
    coverage,
    editorialQuality: Math.round(clamp(title.editorialQuality, 1, 5)),
    genres: [...genres],
    themes: [...themes],
    conceptTags: catalog?.conceptTags ? [...catalog.conceptTags] : [],
    contentWarnings: [...contentWarnings],
    availabilityRegions: rows.length > 0 ? [region.toUpperCase()] : [],
    availabilityProviders: [...new Set(rows.map((row) => row.provider))],
  };

  const languageVariety = title.languageVariety ?? catalog?.languageVariety;
  if (languageVariety !== undefined && languageVariety !== null) {
    candidate.languageVariety = languageVariety;
  }
  const durationMinutes = title.durationMinutes ?? catalog?.durationMinutes;
  if (durationMinutes !== undefined) candidate.durationMinutes = durationMinutes;
  const episodeCount = title.episodeCount ?? catalog?.episodeCount;
  if (episodeCount !== undefined) candidate.episodeCount = episodeCount;
  const episodeMinutes = title.episodeMinutes ?? catalog?.episodeMinutes;
  if (episodeMinutes !== undefined) candidate.episodeMinutes = episodeMinutes;
  const pageCount = title.pageCount ?? catalog?.pageCount;
  if (pageCount !== undefined) candidate.pageCount = pageCount;
  const ageRating = title.ageRating ?? catalog?.ageRating;
  if (ageRating !== undefined && ageRating !== null) candidate.ageRating = ageRating;
  if (catalog?.franchise !== undefined) candidate.franchise = catalog.franchise;
  if (rows.length > 0) {
    candidate.freshnessDays = freshnessDays(rows, now);
  }

  return candidate;
}

export async function loadCandidates(
  deps: MediaServiceDeps,
  targetLang: string,
  region: string,
  now: Date,
): Promise<readonly MediaCandidate[]> {
  const titles = await deps.media.listApprovedTitles(targetLang);
  const ids = titles.map((title) => title.id);
  const availability = await deps.media.listAvailability(ids, region);
  const rowsByMedia = new Map<string, MediaAvailabilityRecord[]>();
  for (const row of availability) {
    const rows = rowsByMedia.get(row.mediaId);
    if (rows) {
      rows.push(row);
    } else {
      rowsByMedia.set(row.mediaId, [row]);
    }
  }

  const candidates: MediaCandidate[] = [];
  for (const title of titles) {
    const rows = rowsByMedia.get(title.id) ?? [];
    const candidate = buildCandidate(title, rows, region, now);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export async function loadWeakConcepts(
  deps: MediaServiceDeps,
  userId: string,
): Promise<{ weakConcepts: string[]; recentErrorTypes: string[] }> {
  const since = new Date(deps.now().getTime() - 28 * 86_400_000).toISOString();
  const [sessionConcepts, assessmentConcepts, errors] = await Promise.all([
    deps.sessions.listConceptStates(userId),
    deps.assessments.listConceptStates(userId),
    deps.sessions.listErrorEventsSince(userId, since),
  ]);

  const mastery = new Map<string, number>();
  for (const state of [...sessionConcepts, ...assessmentConcepts]) {
    const current = mastery.get(state.conceptId);
    const value = Math.min(current ?? Number.POSITIVE_INFINITY, state.mastery);
    mastery.set(state.conceptId, value);
  }

  const weakConcepts = [...mastery.entries()]
    .filter(([, value]) => value < 0.5)
    .map(([conceptId]) => conceptId);

  const recentErrorTypes = [...new Set(errors.map((event) => event.errorType))]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return { weakConcepts, recentErrorTypes };
}

export async function loadHistory(
  deps: MediaServiceDeps,
  profileId: string,
  timezone: string,
): Promise<{
  records: readonly RecommendationRecord[];
  history: RecommendationHistory;
}> {
  const since = new Date(deps.now().getTime() - 90 * 86_400_000).toISOString();
  const records = await deps.media.listRecommendations(profileId, since);
  const today = localDay(deps.now(), timezone);

  const excludedIds = [
    ...new Set(
      records
        .filter(
          (record) =>
            record.status === 'rejected' ||
            record.status === 'finished' ||
            record.status === 'abandoned',
        )
        .map((record) => record.mediaId),
    ),
  ];

  const historyRecords = records.filter(
    (record) => record.status !== 'shown' || localDay(new Date(record.createdAt), timezone) !== today,
  );
  const lastRecommendedIds = [...new Set(historyRecords.map((record) => record.mediaId))];

  const recentTags: Array<{ genres: string[]; themes: string[] }> = [];
  for (const mediaId of lastRecommendedIds) {
    const entry = getMediaTitle(mediaId);
    if (entry) {
      recentTags.push({ genres: [...entry.genres], themes: [...entry.themes] });
    }
  }

  return {
    records,
    history: { excludedIds, lastRecommendedIds, recentTags },
  };
}

export function seedFor(profileId: string, now: Date, timezone: string): number {
  return hashSeed(`${profileId}:${localDay(now, timezone)}`);
}

export function localDay(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function buildTargetConcepts(
  entry: MediaCatalogEntry,
): Array<{ code: string; label: string }> {
  return entry.conceptTags.slice(0, 3).map((code) => {
    const concept = ALL_CONCEPTS.find((item) => item.id === code);
    return { code, label: concept?.title ?? code };
  });
}

export function fallbackExplanation(
  candidate: MediaCandidate,
  request: Parameters<typeof deterministicExplanation>[1],
): ExplanationPayload {
  const reason = deterministicExplanation(candidate, request);
  return { ...reason, mediaId: candidate.id, spoilerFree: true };
}

function freshnessDays(rows: readonly MediaAvailabilityRecord[], now: Date): number {
  let latest = 0;
  for (const row of rows) {
    const checked = Date.parse(row.lastCheckedAt);
    if (Number.isFinite(checked) && checked > latest) latest = checked;
  }
  if (latest === 0) return 0;
  return Math.max(0, Math.floor((now.getTime() - latest) / 86_400_000));
}

function toMediaKind(value: string): MediaKind | null {
  if (value === 'movie' || value === 'series' || value === 'book') return value;
  return null;
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
