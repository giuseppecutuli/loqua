import type { Pool, PoolClient, QueryResultRow } from 'pg';

export type MediaTitleKind = 'movie' | 'series' | 'book' | 'podcast';
export type MediaReviewStatus = 'draft' | 'approved' | 'rejected' | 'retired';
export type MediaAccessType = 'subscription' | 'rent' | 'buy' | 'free' | 'library';
export type DifficultyTolerance = 'easy' | 'balanced' | 'challenging';
export type SubtitlePref = 'target' | 'native' | 'both' | 'none';
export type RecommendationSource = 'rule' | 'llm';
export type RecommendationStatus =
  | 'shown'
  | 'accepted'
  | 'rejected'
  | 'started'
  | 'finished'
  | 'abandoned'
  | 'expired';
export type DifficultyFeedback = 'too_easy' | 'ok' | 'too_hard';
export type MediaProgressStatus = 'planned' | 'watching' | 'reading' | 'finished' | 'abandoned';

export interface MediaTitleRecord {
  readonly id: string;
  readonly kind: MediaTitleKind;
  readonly targetLang: string;
  readonly title: string;
  readonly originalTitle: string | null;
  readonly releaseYear: number | null;
  readonly synopsisNative: string | null;
  readonly difficultyBand: string | null;
  readonly difficultyScore: number | null;
  readonly coverage: Record<string, number>;
  readonly editorialQuality: number;
  readonly languageVariety: string | null;
  readonly subtitleAvailability: string[];
  readonly speechRateWpm: number | null;
  readonly durationMinutes: number | null;
  readonly episodeCount: number | null;
  readonly episodeMinutes: number | null;
  readonly pageCount: number | null;
  readonly ageRating: string | null;
  readonly contentWarnings: string[];
  readonly genres: string[];
  readonly themes: string[];
  readonly externalIds: Record<string, string>;
  readonly coverRef: string | null;
  readonly licenseNote: string | null;
  readonly reviewStatus: MediaReviewStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaAvailabilityRecord {
  readonly id: string;
  readonly mediaId: string;
  readonly region: string;
  readonly provider: string;
  readonly accessType: MediaAccessType;
  readonly providerUrl: string | null;
  readonly priceNote: string | null;
  readonly lastCheckedAt: string;
}

export interface TasteProfileRecord {
  readonly profileId: string;
  readonly formats: string[];
  readonly genres: string[];
  readonly themes: string[];
  readonly disliked: string[];
  readonly genreWeights: Record<string, number>;
  readonly themeWeights: Record<string, number>;
  readonly difficultyTolerance: DifficultyTolerance;
  readonly subtitlePref: SubtitlePref;
  readonly accents: string[];
  readonly region: string;
  readonly weeklyMinutes: number;
  readonly maxAgeRating: string | null;
  readonly coverageOffset: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecommendationRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly mediaId: string;
  readonly score: number;
  readonly scoreJson: Record<string, unknown>;
  readonly reasonText: string | null;
  readonly source: RecommendationSource;
  readonly status: RecommendationStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface RecommendationFeedbackRecord {
  readonly id: string;
  readonly recommendationId: string;
  readonly userId: string;
  readonly rating: number | null;
  readonly reasonCode: string | null;
  readonly difficultyFeedback: DifficultyFeedback | null;
  readonly createdAt: string;
}

export interface MediaProgressRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly mediaId: string;
  readonly status: MediaProgressStatus;
  readonly progressPct: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaGuideRecord {
  readonly id: string;
  readonly mediaId: string;
  readonly profileId: string | null;
  readonly cefrLevel: string;
  readonly guideJson: Record<string, unknown>;
  readonly promptId: string;
  readonly promptVersion: number;
  readonly createdAt: string;
}

export interface MediaStore {
  listApprovedTitles(targetLang: string): Promise<readonly MediaTitleRecord[]>;
  listAvailability(
    mediaIds: readonly string[],
    region: string,
  ): Promise<readonly MediaAvailabilityRecord[]>;
  getTasteProfile(profileId: string): Promise<TasteProfileRecord | null>;
  upsertTasteProfile(record: TasteProfileRecord): Promise<void>;
  deleteTasteProfile(profileId: string): Promise<boolean>;
  getMediaProgress(profileId: string, mediaId: string): Promise<MediaProgressRecord | null>;
  listMediaProgress(profileId: string): Promise<readonly MediaProgressRecord[]>;
  upsertMediaProgress(record: MediaProgressRecord): Promise<void>;
  listRecommendations(profileId: string, since: string): Promise<readonly RecommendationRecord[]>;
  insertRecommendations(records: readonly RecommendationRecord[]): Promise<void>;
  updateRecommendationStatus(
    userId: string,
    id: string,
    status: RecommendationStatus,
  ): Promise<boolean>;
  upsertRecommendationFeedback(record: RecommendationFeedbackRecord): Promise<void>;
  listRecommendationFeedback(
    profileId: string,
    since: string,
  ): Promise<readonly RecommendationFeedbackRecord[]>;
  getMediaGuide(
    mediaId: string,
    profileId: string | null,
    cefrLevel: string,
    promptVersion: number,
  ): Promise<MediaGuideRecord | null>;
  upsertMediaGuide(record: MediaGuideRecord): Promise<void>;
}

interface MediaTitleRow extends QueryResultRow {
  id: string;
  kind: string;
  target_lang: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  synopsis_native: string | null;
  difficulty_band: string | null;
  difficulty_score: number | null;
  coverage_json: unknown;
  editorial_quality: number;
  language_variety: string | null;
  subtitle_availability_json: unknown;
  speech_rate_wpm: number | null;
  duration_minutes: number | null;
  episode_count: number | null;
  episode_minutes: number | null;
  page_count: number | null;
  age_rating: string | null;
  content_warnings_json: unknown;
  genres_json: unknown;
  themes_json: unknown;
  external_ids_json: unknown;
  cover_ref: string | null;
  license_note: string | null;
  review_status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MediaAvailabilityRow extends QueryResultRow {
  id: string;
  media_id: string;
  region: string;
  provider: string;
  access_type: string;
  provider_url: string | null;
  price_note: string | null;
  last_checked_at: Date | string;
}

interface TasteProfileRow extends QueryResultRow {
  profile_id: string;
  formats_json: unknown;
  genres_json: unknown;
  themes_json: unknown;
  disliked_json: unknown;
  genre_weights_json: unknown;
  theme_weights_json: unknown;
  difficulty_tolerance: string;
  subtitle_pref: string;
  accents_json: unknown;
  region: string;
  weekly_minutes: number;
  max_age_rating: string | null;
  coverage_offset: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RecommendationRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  media_id: string;
  score: number;
  score_json: unknown;
  reason_text: string | null;
  source: string;
  status: string;
  created_at: Date | string;
  expires_at: Date | string | null;
}

interface RecommendationFeedbackRow extends QueryResultRow {
  id: string;
  recommendation_id: string;
  user_id: string;
  rating: number | null;
  reason_code: string | null;
  difficulty_feedback: string | null;
  created_at: Date | string;
}

interface MediaProgressRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  media_id: string;
  status: string;
  progress_pct: number;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MediaGuideRow extends QueryResultRow {
  id: string;
  media_id: string;
  profile_id: string | null;
  cefr_level: string;
  guide_json: unknown;
  prompt_id: string;
  prompt_version: number;
  created_at: Date | string;
}

interface ProfileOwnerRow extends QueryResultRow {
  user_id: string;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function jsonStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function jsonNumbers(value: unknown): Record<string, number> {
  const source = jsonRecord(value);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === 'number') result[key] = entry;
  }
  return result;
}

function jsonStringMap(value: unknown): Record<string, string> {
  const source = jsonRecord(value);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === 'string') result[key] = entry;
  }
  return result;
}

function mediaKind(value: string): MediaTitleKind {
  switch (value) {
    case 'movie':
    case 'series':
    case 'book':
    case 'podcast':
      return value;
    default:
      return 'movie';
  }
}

function reviewStatus(value: string): MediaReviewStatus {
  switch (value) {
    case 'draft':
    case 'approved':
    case 'rejected':
    case 'retired':
      return value;
    default:
      return 'draft';
  }
}

function accessType(value: string): MediaAccessType {
  switch (value) {
    case 'subscription':
    case 'rent':
    case 'buy':
    case 'free':
    case 'library':
      return value;
    default:
      return 'free';
  }
}

function difficultyTolerance(value: string): DifficultyTolerance {
  switch (value) {
    case 'easy':
    case 'balanced':
    case 'challenging':
      return value;
    default:
      return 'balanced';
  }
}

function subtitlePref(value: string): SubtitlePref {
  switch (value) {
    case 'target':
    case 'native':
    case 'both':
    case 'none':
      return value;
    default:
      return 'target';
  }
}

function recommendationSource(value: string): RecommendationSource {
  return value === 'llm' ? 'llm' : 'rule';
}

function recommendationStatus(value: string): RecommendationStatus {
  switch (value) {
    case 'shown':
    case 'accepted':
    case 'rejected':
    case 'started':
    case 'finished':
    case 'abandoned':
    case 'expired':
      return value;
    default:
      return 'shown';
  }
}

function difficultyFeedback(value: string | null): DifficultyFeedback | null {
  switch (value) {
    case 'too_easy':
    case 'ok':
    case 'too_hard':
      return value;
    default:
      return null;
  }
}

function mediaProgressStatus(value: string): MediaProgressStatus {
  switch (value) {
    case 'planned':
    case 'watching':
    case 'reading':
    case 'finished':
    case 'abandoned':
      return value;
    default:
      return 'planned';
  }
}

function mapMediaTitle(row: MediaTitleRow): MediaTitleRecord {
  return {
    id: row.id,
    kind: mediaKind(row.kind),
    targetLang: row.target_lang,
    title: row.title,
    originalTitle: row.original_title,
    releaseYear: row.release_year,
    synopsisNative: row.synopsis_native,
    difficultyBand: row.difficulty_band,
    difficultyScore: row.difficulty_score,
    coverage: jsonNumbers(row.coverage_json),
    editorialQuality: row.editorial_quality,
    languageVariety: row.language_variety,
    subtitleAvailability: jsonStrings(row.subtitle_availability_json),
    speechRateWpm: row.speech_rate_wpm,
    durationMinutes: row.duration_minutes,
    episodeCount: row.episode_count,
    episodeMinutes: row.episode_minutes,
    pageCount: row.page_count,
    ageRating: row.age_rating,
    contentWarnings: jsonStrings(row.content_warnings_json),
    genres: jsonStrings(row.genres_json),
    themes: jsonStrings(row.themes_json),
    externalIds: jsonStringMap(row.external_ids_json),
    coverRef: row.cover_ref,
    licenseNote: row.license_note,
    reviewStatus: reviewStatus(row.review_status),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

function mapAvailability(row: MediaAvailabilityRow): MediaAvailabilityRecord {
  return {
    id: row.id,
    mediaId: row.media_id,
    region: row.region,
    provider: row.provider,
    accessType: accessType(row.access_type),
    providerUrl: row.provider_url,
    priceNote: row.price_note,
    lastCheckedAt: requiredIso(row.last_checked_at),
  };
}

function mapTasteProfile(row: TasteProfileRow): TasteProfileRecord {
  return {
    profileId: row.profile_id,
    formats: jsonStrings(row.formats_json),
    genres: jsonStrings(row.genres_json),
    themes: jsonStrings(row.themes_json),
    disliked: jsonStrings(row.disliked_json),
    genreWeights: jsonNumbers(row.genre_weights_json),
    themeWeights: jsonNumbers(row.theme_weights_json),
    difficultyTolerance: difficultyTolerance(row.difficulty_tolerance),
    subtitlePref: subtitlePref(row.subtitle_pref),
    accents: jsonStrings(row.accents_json),
    region: row.region,
    weeklyMinutes: row.weekly_minutes,
    maxAgeRating: row.max_age_rating,
    coverageOffset: row.coverage_offset,
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

function mapRecommendation(row: RecommendationRow): RecommendationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    mediaId: row.media_id,
    score: row.score,
    scoreJson: jsonRecord(row.score_json),
    reasonText: row.reason_text,
    source: recommendationSource(row.source),
    status: recommendationStatus(row.status),
    createdAt: requiredIso(row.created_at),
    expiresAt: iso(row.expires_at),
  };
}

function mapRecommendationFeedback(row: RecommendationFeedbackRow): RecommendationFeedbackRecord {
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    userId: row.user_id,
    rating: row.rating,
    reasonCode: row.reason_code,
    difficultyFeedback: difficultyFeedback(row.difficulty_feedback),
    createdAt: requiredIso(row.created_at),
  };
}

function mapMediaProgress(row: MediaProgressRow): MediaProgressRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    mediaId: row.media_id,
    status: mediaProgressStatus(row.status),
    progressPct: row.progress_pct,
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

function mapMediaGuide(row: MediaGuideRow): MediaGuideRecord {
  return {
    id: row.id,
    mediaId: row.media_id,
    profileId: row.profile_id,
    cefrLevel: row.cefr_level,
    guideJson: jsonRecord(row.guide_json),
    promptId: row.prompt_id,
    promptVersion: row.prompt_version,
    createdAt: requiredIso(row.created_at),
  };
}

export class PostgresMediaStore implements MediaStore {
  constructor(private readonly pool: Pool) {}

  private async withUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async withAuthenticated<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', '', true)");
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async withService<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async ownerForProfile(profileId: string): Promise<string | null> {
    const result = await this.pool.query<ProfileOwnerRow>(
      'SELECT user_id FROM public.learner_profiles WHERE id = $1',
      [profileId],
    );
    return result.rows[0]?.user_id ?? null;
  }

  private async withProfile<T>(
    profileId: string,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T | null> {
    const userId = await this.ownerForProfile(profileId);
    if (!userId) return null;
    return this.withUser(userId, work);
  }

  async listApprovedTitles(targetLang: string): Promise<readonly MediaTitleRecord[]> {
    return this.withAuthenticated(async (client) => {
      const result = await client.query<MediaTitleRow>(
        `SELECT * FROM public.media_titles
         WHERE target_lang = $1 AND review_status = 'approved'
         ORDER BY difficulty_score NULLS LAST, title`,
        [targetLang],
      );
      return result.rows.map(mapMediaTitle);
    });
  }

  async listAvailability(
    mediaIds: readonly string[],
    region: string,
  ): Promise<readonly MediaAvailabilityRecord[]> {
    if (mediaIds.length === 0) return [];
    return this.withAuthenticated(async (client) => {
      const result = await client.query<MediaAvailabilityRow>(
        `SELECT * FROM public.media_availability
         WHERE media_id = ANY($1::text[]) AND region = $2
         ORDER BY media_id, provider, access_type`,
        [mediaIds, region],
      );
      return result.rows.map(mapAvailability);
    });
  }

  async getTasteProfile(profileId: string): Promise<TasteProfileRecord | null> {
    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<TasteProfileRow>(
        'SELECT * FROM public.user_taste_profile WHERE profile_id = $1',
        [profileId],
      );
      return rows.rows[0] ? mapTasteProfile(rows.rows[0]) : null;
    });
    return result;
  }

  async upsertTasteProfile(record: TasteProfileRecord): Promise<void> {
    const result = await this.withProfile(record.profileId, async (client) => {
      await client.query(
        `INSERT INTO public.user_taste_profile
           (profile_id, formats_json, genres_json, themes_json, disliked_json, genre_weights_json,
            theme_weights_json, difficulty_tolerance, subtitle_pref, accents_json, region,
            weekly_minutes, max_age_rating, coverage_offset, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9,
                 $10::jsonb, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (profile_id) DO UPDATE
         SET formats_json = EXCLUDED.formats_json,
             genres_json = EXCLUDED.genres_json,
             themes_json = EXCLUDED.themes_json,
             disliked_json = EXCLUDED.disliked_json,
             genre_weights_json = EXCLUDED.genre_weights_json,
             theme_weights_json = EXCLUDED.theme_weights_json,
             difficulty_tolerance = EXCLUDED.difficulty_tolerance,
             subtitle_pref = EXCLUDED.subtitle_pref,
             accents_json = EXCLUDED.accents_json,
             region = EXCLUDED.region,
             weekly_minutes = EXCLUDED.weekly_minutes,
             max_age_rating = EXCLUDED.max_age_rating,
             coverage_offset = EXCLUDED.coverage_offset,
             updated_at = EXCLUDED.updated_at`,
        [
          record.profileId,
          JSON.stringify(record.formats),
          JSON.stringify(record.genres),
          JSON.stringify(record.themes),
          JSON.stringify(record.disliked),
          JSON.stringify(record.genreWeights),
          JSON.stringify(record.themeWeights),
          record.difficultyTolerance,
          record.subtitlePref,
          JSON.stringify(record.accents),
          record.region,
          record.weeklyMinutes,
          record.maxAgeRating,
          record.coverageOffset,
          record.createdAt,
          record.updatedAt,
        ],
      );
      return true;
    });
    if (result === null) throw new Error('profile_not_found');
  }

  async deleteTasteProfile(profileId: string): Promise<boolean> {
    const result = await this.withProfile(profileId, async (client) => {
      const deleted = await client.query(
        'DELETE FROM public.user_taste_profile WHERE profile_id = $1 RETURNING profile_id',
        [profileId],
      );
      return (deleted.rowCount ?? 0) > 0;
    });
    return result ?? false;
  }

  async getMediaProgress(
    profileId: string,
    mediaId: string,
  ): Promise<MediaProgressRecord | null> {
    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<MediaProgressRow>(
        'SELECT * FROM public.media_progress WHERE profile_id = $1 AND media_id = $2',
        [profileId, mediaId],
      );
      return rows.rows[0] ? mapMediaProgress(rows.rows[0]) : null;
    });
    return result;
  }

  async listMediaProgress(profileId: string): Promise<readonly MediaProgressRecord[]> {
    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<MediaProgressRow>(
        'SELECT * FROM public.media_progress WHERE profile_id = $1 ORDER BY created_at',
        [profileId],
      );
      return rows.rows.map(mapMediaProgress);
    });
    return result ?? [];
  }

  async upsertMediaProgress(record: MediaProgressRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `INSERT INTO public.media_progress
           (id, user_id, profile_id, media_id, status, progress_pct, started_at, finished_at,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (profile_id, media_id) DO UPDATE
         SET status = EXCLUDED.status,
             progress_pct = EXCLUDED.progress_pct,
             started_at = EXCLUDED.started_at,
             finished_at = EXCLUDED.finished_at,
             updated_at = EXCLUDED.updated_at`,
        [
          record.id,
          record.userId,
          record.profileId,
          record.mediaId,
          record.status,
          record.progressPct,
          record.startedAt,
          record.finishedAt,
          record.createdAt,
          record.updatedAt,
        ],
      );
    });
  }

  async listRecommendations(
    profileId: string,
    since: string,
  ): Promise<readonly RecommendationRecord[]> {
    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<RecommendationRow>(
        `SELECT * FROM public.recommendations
         WHERE profile_id = $1 AND created_at >= $2
         ORDER BY created_at DESC`,
        [profileId, since],
      );
      return rows.rows.map(mapRecommendation);
    });
    return result ?? [];
  }

  async insertRecommendations(records: readonly RecommendationRecord[]): Promise<void> {
    if (records.length === 0) return;
    const userId = records[0]?.userId;
    if (!userId) return;

    await this.withUser(userId, async (client) => {
      for (const record of records) {
        await client.query(
          `INSERT INTO public.recommendations
             (id, user_id, profile_id, media_id, score, score_json, reason_text, source, status,
              created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            record.id,
            record.userId,
            record.profileId,
            record.mediaId,
            record.score,
            JSON.stringify(record.scoreJson),
            record.reasonText,
            record.source,
            record.status,
            record.createdAt,
            record.expiresAt,
          ],
        );
      }
    });
  }

  async updateRecommendationStatus(
    userId: string,
    id: string,
    status: RecommendationStatus,
  ): Promise<boolean> {
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        'UPDATE public.recommendations SET status = $1 WHERE id = $2 AND user_id = $3',
        [status, id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async upsertRecommendationFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `INSERT INTO public.recommendation_feedback
           (id, recommendation_id, user_id, rating, reason_code, difficulty_feedback, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (recommendation_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating,
             reason_code = EXCLUDED.reason_code,
             difficulty_feedback = EXCLUDED.difficulty_feedback`,
        [
          record.id,
          record.recommendationId,
          record.userId,
          record.rating,
          record.reasonCode,
          record.difficultyFeedback,
          record.createdAt,
        ],
      );
    });
  }

  async listRecommendationFeedback(
    profileId: string,
    since: string,
  ): Promise<readonly RecommendationFeedbackRecord[]> {
    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<RecommendationFeedbackRow>(
        `SELECT f.* FROM public.recommendation_feedback f
         JOIN public.recommendations r ON r.id = f.recommendation_id
         WHERE r.profile_id = $1 AND f.created_at >= $2
         ORDER BY f.created_at`,
        [profileId, since],
      );
      return rows.rows.map(mapRecommendationFeedback);
    });
    return result ?? [];
  }

  async getMediaGuide(
    mediaId: string,
    profileId: string | null,
    cefrLevel: string,
    promptVersion: number,
  ): Promise<MediaGuideRecord | null> {
    if (profileId === null) {
      return this.withAuthenticated(async (client) => {
        const rows = await client.query<MediaGuideRow>(
          `SELECT * FROM public.media_guides
           WHERE media_id = $1 AND profile_id IS NULL AND cefr_level = $2
             AND prompt_version = $3`,
          [mediaId, cefrLevel, promptVersion],
        );
        return rows.rows[0] ? mapMediaGuide(rows.rows[0]) : null;
      });
    }

    const result = await this.withProfile(profileId, async (client) => {
      const rows = await client.query<MediaGuideRow>(
        `SELECT * FROM public.media_guides
         WHERE media_id = $1 AND profile_id = $2 AND cefr_level = $3
           AND prompt_version = $4`,
        [mediaId, profileId, cefrLevel, promptVersion],
      );
      return rows.rows[0] ? mapMediaGuide(rows.rows[0]) : null;
    });
    return result;
  }

  async upsertMediaGuide(record: MediaGuideRecord): Promise<void> {
    const write = async (client: PoolClient): Promise<void> => {
      await client.query(
        `INSERT INTO public.media_guides
           (id, media_id, profile_id, cefr_level, guide_json, prompt_id, prompt_version, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         ON CONFLICT (media_id, profile_id, cefr_level, prompt_version) DO UPDATE
         SET guide_json = EXCLUDED.guide_json,
             prompt_id = EXCLUDED.prompt_id`,
        [
          record.id,
          record.mediaId,
          record.profileId,
          record.cefrLevel,
          JSON.stringify(record.guideJson),
          record.promptId,
          record.promptVersion,
          record.createdAt,
        ],
      );
    };

    if (record.profileId === null) {
      await this.withService(write);
      return;
    }

    const result = await this.withProfile(record.profileId, write);
    if (result === null) throw new Error('profile_not_found');
  }
}
