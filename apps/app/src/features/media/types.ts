import type {
  MediaCandidate,
  MediaExplanation,
  MediaFeedback,
  MediaGuide,
  TasteProfile,
} from '@loqua/core';

export type MediaProgressStatus = 'watching' | 'reading' | 'finished' | 'abandoned';
export type MediaFeedbackKind = MediaFeedback['kind'];

export interface MediaTaste extends TasteProfile {
  readonly profileId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type MediaReason = MediaExplanation;

export interface MediaRecommendationComponents {
  readonly levelFit: number;
  readonly tasteMatch: number;
  readonly gapFit: number;
  readonly quality: number;
  readonly diversity: number;
  readonly freshness: number;
}

export interface MediaRecommendationView {
  readonly recommendationId: string;
  readonly status: string;
  readonly media: MediaCandidate;
  readonly score: number;
  readonly components: MediaRecommendationComponents;
  readonly reason: MediaReason;
}

export interface MediaGuideView extends MediaGuide {
  readonly spoilerFree: boolean;
}

export interface MediaProgressView {
  readonly id: string;
  readonly mediaId: string;
  readonly status: MediaProgressStatus;
  readonly progressPct: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaPlanView {
  readonly weeklyMinutes: number;
  readonly focus: MediaCandidate | null;
  readonly nextStep: string;
}

export interface MediaReflectionSummary {
  readonly countsAsProduction: boolean;
  readonly praise?: string;
  readonly nextFocus: readonly string[];
}

export interface MediaSavedPhrase {
  readonly id: string;
  readonly text: string;
}

export interface MediaReflectionView {
  readonly reflection: MediaReflectionSummary;
  readonly savedPhrases: readonly MediaSavedPhrase[];
  readonly xpAwarded: number;
}

export interface MediaFeedbackInput {
  readonly kind: MediaFeedbackKind;
  readonly rating?: number;
  readonly difficulty?: 'too_easy' | 'ok' | 'too_hard';
  readonly reasonCode?: string;
  readonly recommendationId?: string;
}

export interface MediaReflectionInput {
  readonly text: string;
  readonly durationSec?: number;
  readonly phrases: readonly string[];
}
