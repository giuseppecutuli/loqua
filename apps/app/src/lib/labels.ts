import type { ConsentKind, Goal, SkillDomain } from '@loqua/core';
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
