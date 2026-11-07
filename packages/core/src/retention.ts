import { toUtcIso } from './dates.js';

export interface RetentionPolicy {
  readonly audioHours: number;
  readonly transcriptDays: number;
  readonly mediaRecommendationDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  audioHours: 48,
  transcriptDays: 90,
  mediaRecommendationDays: 14,
};

export interface RetentionCutoffs {
  readonly audioBefore: string;
  readonly transcriptBefore: string;
  readonly mediaRecommendationBefore: string;
}

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

export function retentionCutoffs(
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionCutoffs {
  return {
    audioBefore: toUtcIso(subtractHours(now, policy.audioHours)),
    transcriptBefore: toUtcIso(subtractDays(now, policy.transcriptDays)),
    mediaRecommendationBefore: toUtcIso(subtractDays(now, policy.mediaRecommendationDays)),
  };
}

function isBefore(value: string, cutoff: string): boolean {
  return Date.parse(value) < Date.parse(cutoff);
}

export function isAudioExpired(
  createdAt: string,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): boolean {
  return isBefore(createdAt, retentionCutoffs(now, policy).audioBefore);
}

export function isTranscriptExpired(
  createdAt: string,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): boolean {
  return isBefore(createdAt, retentionCutoffs(now, policy).transcriptBefore);
}

export function isMediaRecommendationExpired(
  createdAt: string,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): boolean {
  return isBefore(createdAt, retentionCutoffs(now, policy).mediaRecommendationBefore);
}
