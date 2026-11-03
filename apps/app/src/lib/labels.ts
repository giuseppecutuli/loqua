import type {
  ConsentKind,
  DifficultyTolerance,
  Goal,
  MediaGenre,
  MediaKind,
  MediaTheme,
  SkillDomain,
  SubtitlePref,
} from '@loqua/core';
import type { TranslationKey } from '@loqua/ui';

export const GOAL_LABELS: Record<Goal, TranslationKey> = {
  work: 'onboarding.goal.work',
  travel: 'onboarding.goal.travel',
  daily: 'onboarding.goal.daily',
  comprehension: 'onboarding.goal.comprehension',
  exam: 'onboarding.goal.exam',
};

export const SKILL_LABELS: Record<SkillDomain, TranslationKey> = {
  grammar: 'progress.skill.grammar',
  vocabulary: 'progress.skill.vocabulary',
  listening: 'progress.skill.listening',
  speaking: 'progress.skill.speaking',
  reading: 'progress.skill.reading',
  writing: 'progress.skill.writing',
  pragmatics: 'progress.skill.pragmatics',
};

export const CONSENT_LABELS: Record<ConsentKind, TranslationKey> = {
  terms: 'settings.consent.terms',
  privacy: 'settings.consent.privacy',
  voice: 'settings.consent.voice',
  ai_processing: 'settings.consent.ai_processing',
  analytics: 'settings.consent.analytics',
};

export type MediaRegion = 'IT' | 'US' | 'GB' | 'FR' | 'DE' | 'ES';
export type MediaDislike = 'horror' | 'gore' | 'musical' | 'slow_pace';

export const MEDIA_REGIONS: readonly MediaRegion[] = ['IT', 'US', 'GB', 'FR', 'DE', 'ES'];
export const MEDIA_WEEKLY_MINUTES = [30, 60, 120, 180, 300] as const;
export const MEDIA_DISLIKES: readonly MediaDislike[] = [
  'horror',
  'gore',
  'musical',
  'slow_pace',
];

export const MEDIA_KIND_LABELS: Record<MediaKind, TranslationKey> = {
  movie: 'media.kind.movie',
  series: 'media.kind.series',
  book: 'media.kind.book',
};

export const MEDIA_GENRE_LABELS: Record<MediaGenre, TranslationKey> = {
  comedy: 'media.genre.comedy',
  drama: 'media.genre.drama',
  thriller: 'media.genre.thriller',
  sci_fi: 'media.genre.sci_fi',
  fantasy: 'media.genre.fantasy',
  documentary: 'media.genre.documentary',
  romance: 'media.genre.romance',
  crime: 'media.genre.crime',
  biography: 'media.genre.biography',
  business: 'media.genre.business',
  tech: 'media.genre.tech',
  history: 'media.genre.history',
  sport: 'media.genre.sport',
};

export const MEDIA_THEME_LABELS: Record<MediaTheme, TranslationKey> = {
  work: 'media.theme.work',
  travel: 'media.theme.travel',
  daily_life: 'media.theme.daily_life',
  relationships: 'media.theme.relationships',
  humor: 'media.theme.humor',
  mystery: 'media.theme.mystery',
  society: 'media.theme.society',
  science: 'media.theme.science',
};

export const MEDIA_DIFFICULTY_LABELS: Record<DifficultyTolerance, TranslationKey> = {
  easy: 'media.difficulty.easy',
  balanced: 'media.difficulty.balanced',
  challenging: 'media.difficulty.challenging',
};

export const MEDIA_SUBTITLE_LABELS: Record<SubtitlePref, TranslationKey> = {
  target: 'media.subtitle.target',
  native: 'media.subtitle.native',
  both: 'media.subtitle.both',
  none: 'media.subtitle.none',
};

export const MEDIA_REGION_LABELS: Record<MediaRegion, TranslationKey> = {
  IT: 'media.region.IT',
  US: 'media.region.US',
  GB: 'media.region.GB',
  FR: 'media.region.FR',
  DE: 'media.region.DE',
  ES: 'media.region.ES',
};

export const MEDIA_DISLIKE_LABELS: Record<MediaDislike, TranslationKey> = {
  horror: 'media.dislike.horror',
  gore: 'media.dislike.gore',
  musical: 'media.dislike.musical',
  slow_pace: 'media.dislike.slow_pace',
};
