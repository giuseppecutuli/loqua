import type {
  MediaAvailabilityRecord,
  MediaGuideRecord,
  MediaProgressRecord,
  MediaStore,
  MediaTitleRecord,
  RecommendationFeedbackRecord,
  RecommendationRecord,
  RecommendationStatus,
  TasteProfileRecord,
} from '@loqua/db-postgres';

export type {
  DifficultyFeedback,
  DifficultyTolerance,
  MediaAccessType,
  MediaAvailabilityRecord,
  MediaGuideRecord,
  MediaProgressRecord,
  MediaProgressStatus,
  MediaReviewStatus,
  MediaStore,
  MediaTitleKind,
  MediaTitleRecord,
  RecommendationFeedbackRecord,
  RecommendationRecord,
  RecommendationSource,
  RecommendationStatus,
  SubtitlePref,
  TasteProfileRecord,
} from '@loqua/db-postgres';

export class InMemoryMediaStore implements MediaStore {
  private readonly titles: MediaTitleRecord[] = [];
  private readonly availability: MediaAvailabilityRecord[] = [];
  private readonly tasteProfiles = new Map<string, TasteProfileRecord>();
  private readonly recommendations = new Map<string, RecommendationRecord>();
  private readonly feedback = new Map<string, RecommendationFeedbackRecord>();
  private readonly progress = new Map<string, MediaProgressRecord>();
  private readonly guides = new Map<string, MediaGuideRecord>();

  seedTitles(titles: readonly MediaTitleRecord[]): void {
    this.titles.push(...titles);
  }

  seedAvailability(records: readonly MediaAvailabilityRecord[]): void {
    this.availability.push(...records);
  }

  async listApprovedTitles(targetLang: string): Promise<readonly MediaTitleRecord[]> {
    return this.titles
      .filter((title) => title.targetLang === targetLang && title.reviewStatus === 'approved')
      .sort(
        (left, right) =>
          (left.difficultyScore ?? Number.POSITIVE_INFINITY) -
            (right.difficultyScore ?? Number.POSITIVE_INFINITY) ||
          left.title.localeCompare(right.title),
      );
  }

  async listAvailability(
    mediaIds: readonly string[],
    region: string,
  ): Promise<readonly MediaAvailabilityRecord[]> {
    const wanted = new Set(mediaIds);
    return this.availability
      .filter((record) => wanted.has(record.mediaId) && record.region === region)
      .sort(
        (left, right) =>
          left.mediaId.localeCompare(right.mediaId) ||
          left.provider.localeCompare(right.provider) ||
          left.accessType.localeCompare(right.accessType),
      );
  }

  async getTasteProfile(profileId: string): Promise<TasteProfileRecord | null> {
    return this.tasteProfiles.get(profileId) ?? null;
  }

  async upsertTasteProfile(record: TasteProfileRecord): Promise<void> {
    const existing = this.tasteProfiles.get(record.profileId);
    this.tasteProfiles.set(record.profileId, {
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
    });
  }

  async deleteTasteProfile(profileId: string): Promise<boolean> {
    return this.tasteProfiles.delete(profileId);
  }

  async getMediaProgress(
    profileId: string,
    mediaId: string,
  ): Promise<MediaProgressRecord | null> {
    return this.progress.get(`${profileId}:${mediaId}`) ?? null;
  }

  async listMediaProgress(profileId: string): Promise<readonly MediaProgressRecord[]> {
    return [...this.progress.values()]
      .filter((record) => record.profileId === profileId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async upsertMediaProgress(record: MediaProgressRecord): Promise<void> {
    const key = `${record.profileId}:${record.mediaId}`;
    const existing = this.progress.get(key);
    this.progress.set(key, {
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
    });
  }

  async listRecommendations(
    profileId: string,
    since: string,
  ): Promise<readonly RecommendationRecord[]> {
    return [...this.recommendations.values()]
      .filter((record) => record.profileId === profileId && record.createdAt >= since)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async insertRecommendations(records: readonly RecommendationRecord[]): Promise<void> {
    for (const record of records) {
      if (!this.recommendations.has(record.id)) {
        this.recommendations.set(record.id, record);
      }
    }
  }

  async updateRecommendationStatus(
    userId: string,
    id: string,
    status: RecommendationStatus,
  ): Promise<boolean> {
    const record = this.recommendations.get(id);
    if (!record || record.userId !== userId) return false;
    this.recommendations.set(id, { ...record, status });
    return true;
  }

  async upsertRecommendationFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    const key = `${record.recommendationId}:${record.userId}`;
    const existing = this.feedback.get(key);
    this.feedback.set(key, {
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
    });
  }

  async listRecommendationFeedback(
    profileId: string,
    since: string,
  ): Promise<readonly RecommendationFeedbackRecord[]> {
    const recommendationIds = new Set(
      [...this.recommendations.values()]
        .filter((record) => record.profileId === profileId)
        .map((record) => record.id),
    );
    return [...this.feedback.values()]
      .filter(
        (record) =>
          recommendationIds.has(record.recommendationId) && record.createdAt >= since,
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async getMediaGuide(
    mediaId: string,
    profileId: string | null,
    cefrLevel: string,
    promptVersion: number,
  ): Promise<MediaGuideRecord | null> {
    return this.guides.get(guideKey(mediaId, profileId, cefrLevel, promptVersion)) ?? null;
  }

  async upsertMediaGuide(record: MediaGuideRecord): Promise<void> {
    const key = guideKey(
      record.mediaId,
      record.profileId,
      record.cefrLevel,
      record.promptVersion,
    );
    const existing = this.guides.get(key);
    this.guides.set(key, {
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
    });
  }
}

function guideKey(
  mediaId: string,
  profileId: string | null,
  cefrLevel: string,
  promptVersion: number,
): string {
  return `${mediaId}:${profileId ?? ''}:${cefrLevel}:${promptVersion}`;
}
