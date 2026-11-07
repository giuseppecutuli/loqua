import { learnerProfileSchema, type LearnerProfile, type LearnerProfilePatch } from '@loqua/core';

export interface BuildProfileInput {
  readonly existing: LearnerProfile | null;
  readonly patch: LearnerProfilePatch;
  readonly userId: string;
  readonly newId: string;
  readonly now: string;
}

export type BuildProfileResult =
  | { readonly ok: true; readonly profile: LearnerProfile }
  | { readonly ok: false; readonly error: 'onboarding_incomplete' | 'invalid_profile' };

export function buildProfile(input: BuildProfileInput): BuildProfileResult {
  const { existing, patch, userId, newId, now } = input;

  if (
    !existing &&
    (patch.goal === undefined ||
      patch.dailyMinutes === undefined ||
      patch.timezone === undefined ||
      patch.interests === undefined ||
      patch.interests.length === 0)
  ) {
    return { ok: false, error: 'onboarding_incomplete' };
  }

  const profile: LearnerProfile = {
    id: existing?.id ?? newId,
    userId,
    targetLang: existing?.targetLang ?? 'en',
    nativeLang: existing?.nativeLang ?? 'it',
    uiLocale: patch.uiLocale ?? existing?.uiLocale ?? 'it',
    explanationMode: patch.explanationMode ?? existing?.explanationMode ?? 'target_simple',
    proficiencyFramework: existing?.proficiencyFramework ?? 'CEFR',
    proficiencyEstimate: existing?.proficiencyEstimate ?? null,
    goal: patch.goal ?? existing?.goal ?? null,
    dailyMinutes: patch.dailyMinutes ?? existing?.dailyMinutes ?? 20,
    streakMode: patch.streakMode ?? existing?.streakMode ?? 'flexible',
    timezone: patch.timezone ?? existing?.timezone ?? 'Europe/Rome',
    interests: patch.interests ?? existing?.interests ?? [],
    selfAssessment: patch.selfAssessment ?? existing?.selfAssessment ?? {},
    onboardingCompleted: existing?.onboardingCompleted ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };

  const validated = learnerProfileSchema.safeParse(profile);
  if (!validated.success) return { ok: false, error: 'invalid_profile' };
  return { ok: true, profile: validated.data };
}
