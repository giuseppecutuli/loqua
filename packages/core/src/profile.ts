import { isIanaTimezone, toUtcIso } from './dates.js';
import {
  DEFAULT_EXPLANATION_MODE,
  DEFAULT_LANGUAGE_PROFILE,
  DEFAULT_NATIVE_LANG,
  DEFAULT_PROFICIENCY_FRAMEWORK,
  DEFAULT_TARGET_LANG,
  DEFAULT_UI_LOCALE,
  resolveUiLocale,
  validateLanguageProfile,
  type ExplanationMode,
  type UiLocale,
} from './language.js';
import type { Result } from './result.js';
import { CEFR_LEVELS, SKILL_DOMAINS, isCefrLevel, type CefrLevel, type SkillDomain } from './skills.js';

export const GOALS = ['work', 'travel', 'daily', 'comprehension', 'exam'] as const;
export type Goal = (typeof GOALS)[number];

export const STREAK_MODES = ['daily', 'flexible', 'weekend_off'] as const;
export type StreakMode = (typeof STREAK_MODES)[number];

export const ONBOARDING_STEPS = ['goal', 'time', 'self_assessment', 'interests'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DEFAULT_DAILY_MINUTES = 20;
export const MIN_DAILY_MINUTES = 5;
export const MAX_DAILY_MINUTES = 60;
export const MAX_INTERESTS = 12;
export const MAX_INTEREST_LENGTH = 40;

export interface LearnerProfile {
  readonly id: string;
  readonly userId: string;
  readonly targetLang: string;
  readonly nativeLang: string;
  readonly uiLocale: UiLocale;
  readonly explanationMode: ExplanationMode;
  readonly proficiencyFramework: string;
  readonly proficiencyEstimate: CefrLevel | null;
  readonly goal: Goal | null;
  readonly dailyMinutes: number;
  readonly streakMode: StreakMode;
  readonly timezone: string;
  readonly interests: readonly string[];
  readonly selfAssessment: Partial<Record<SkillDomain, CefrLevel>>;
  readonly onboardingCompleted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface OnboardingInput {
  readonly goal: Goal;
  readonly dailyMinutes: number;
  readonly timezone: string;
  readonly interests: readonly string[];
  readonly selfAssessment: Partial<Record<SkillDomain, CefrLevel>>;
  readonly streakMode?: StreakMode;
}

export type ProfileErrorCode =
  | 'goal_invalid'
  | 'daily_minutes_invalid'
  | 'timezone_invalid'
  | 'interests_invalid'
  | 'self_assessment_invalid'
  | 'streak_mode_invalid'
  | 'language_invalid'
  | 'profile_not_found';

export interface ProfileError {
  readonly code: ProfileErrorCode;
  readonly field?: string;
}

export function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOALS as readonly string[]).includes(value);
}

export function isStreakMode(value: unknown): value is StreakMode {
  return typeof value === 'string' && (STREAK_MODES as readonly string[]).includes(value);
}

function normalizeInterests(interests: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of interests) {
    const value = raw.trim();
    if (value.length === 0) continue;
    const key = value.toLocaleLowerCase('en');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function validateOnboarding(
  input: OnboardingInput,
): Result<OnboardingInput, readonly ProfileError[]> {
  const errors: ProfileError[] = [];

  if (!isGoal(input.goal)) errors.push({ code: 'goal_invalid', field: 'goal' });

  if (
    !Number.isInteger(input.dailyMinutes) ||
    input.dailyMinutes < MIN_DAILY_MINUTES ||
    input.dailyMinutes > MAX_DAILY_MINUTES
  ) {
    errors.push({ code: 'daily_minutes_invalid', field: 'daily_minutes' });
  }

  if (!isIanaTimezone(input.timezone)) {
    errors.push({ code: 'timezone_invalid', field: 'timezone' });
  }

  const interests = normalizeInterests(input.interests);
  if (
    interests.length === 0 ||
    interests.length > MAX_INTERESTS ||
    interests.some((interest) => interest.length > MAX_INTEREST_LENGTH)
  ) {
    errors.push({ code: 'interests_invalid', field: 'interests' });
  }

  for (const [domain, level] of Object.entries(input.selfAssessment)) {
    if (!(SKILL_DOMAINS as readonly string[]).includes(domain) || !isCefrLevel(level)) {
      errors.push({ code: 'self_assessment_invalid', field: `self_assessment.${domain}` });
    }
  }

  if (input.streakMode !== undefined && !isStreakMode(input.streakMode)) {
    errors.push({ code: 'streak_mode_invalid', field: 'streak_mode' });
  }

  if (errors.length > 0) return { ok: false, error: errors };

  return {
    ok: true,
    value: {
      ...input,
      interests,
      selfAssessment: { ...input.selfAssessment },
      streakMode: input.streakMode ?? 'flexible',
    },
  };
}

export interface CreateProfileContext {
  readonly id: string;
  readonly userId: string;
  readonly now: Date;
  readonly language?: Partial<{
    targetLang: string;
    nativeLang: string;
    uiLocale: UiLocale;
    explanationMode: ExplanationMode;
    proficiencyFramework: string;
  }>;
  readonly proficiencyEstimate?: CefrLevel | null;
}

export function createLearnerProfile(
  input: OnboardingInput,
  context: CreateProfileContext,
): Result<LearnerProfile, readonly ProfileError[]> {
  const validation = validateOnboarding(input);
  if (!validation.ok) return validation;

  const language = validateLanguageProfile({
    targetLang: context.language?.targetLang ?? DEFAULT_TARGET_LANG,
    nativeLang: context.language?.nativeLang ?? DEFAULT_NATIVE_LANG,
    uiLocale: context.language?.uiLocale ?? DEFAULT_UI_LOCALE,
    explanationMode: context.language?.explanationMode ?? DEFAULT_EXPLANATION_MODE,
    proficiencyFramework: context.language?.proficiencyFramework ?? DEFAULT_PROFICIENCY_FRAMEWORK,
  });
  if (!language.ok) {
    return {
      ok: false,
      error: language.errors.map((code) => ({ code: 'language_invalid' as const, field: code })),
    };
  }

  const timestamp = toUtcIso(context.now);
  const value = validation.value;

  return {
    ok: true,
    value: {
      id: context.id,
      userId: context.userId,
      targetLang: language.value.targetLang,
      nativeLang: language.value.nativeLang,
      uiLocale: language.value.uiLocale,
      explanationMode: language.value.explanationMode,
      proficiencyFramework: language.value.proficiencyFramework,
      proficiencyEstimate: context.proficiencyEstimate ?? null,
      goal: value.goal,
      dailyMinutes: value.dailyMinutes,
      streakMode: value.streakMode ?? 'flexible',
      timezone: value.timezone,
      interests: value.interests,
      selfAssessment: value.selfAssessment,
      onboardingCompleted: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  };
}

export function isOnboardingComplete(profile: LearnerProfile): boolean {
  return (
    profile.onboardingCompleted &&
    profile.goal !== null &&
    profile.interests.length > 0 &&
    isIanaTimezone(profile.timezone)
  );
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export function updateLearnerProfile(
  profile: LearnerProfile,
  patch: Partial<
    Pick<
      LearnerProfile,
      | 'goal'
      | 'dailyMinutes'
      | 'timezone'
      | 'interests'
      | 'streakMode'
      | 'explanationMode'
      | 'uiLocale'
      | 'selfAssessment'
    >
  >,
  now: Date,
): Result<LearnerProfile, readonly ProfileError[]> {
  if (profile.deletedAt !== null) {
    return { ok: false, error: [{ code: 'profile_not_found' }] };
  }

  const merged: LearnerProfile = {
    ...profile,
    ...patch,
    interests: patch.interests ? normalizeInterests(patch.interests) : profile.interests,
    selfAssessment: patch.selfAssessment ?? profile.selfAssessment,
    updatedAt: toUtcIso(now),
  };

  const errors: ProfileError[] = [];
  if (merged.goal !== null && !isGoal(merged.goal)) errors.push({ code: 'goal_invalid', field: 'goal' });
  if (
    !Number.isInteger(merged.dailyMinutes) ||
    merged.dailyMinutes < MIN_DAILY_MINUTES ||
    merged.dailyMinutes > MAX_DAILY_MINUTES
  ) {
    errors.push({ code: 'daily_minutes_invalid', field: 'daily_minutes' });
  }
  if (!isIanaTimezone(merged.timezone)) errors.push({ code: 'timezone_invalid', field: 'timezone' });
  if (
    merged.interests.length === 0 ||
    merged.interests.length > MAX_INTERESTS ||
    merged.interests.some((interest) => interest.length > MAX_INTEREST_LENGTH)
  ) {
    errors.push({ code: 'interests_invalid', field: 'interests' });
  }
  if (!isStreakMode(merged.streakMode)) errors.push({ code: 'streak_mode_invalid', field: 'streak_mode' });
  if (!isCefrLevel(merged.proficiencyEstimate) && merged.proficiencyEstimate !== null) {
    errors.push({ code: 'self_assessment_invalid', field: 'proficiency_estimate' });
  }

  if (errors.length > 0) return { ok: false, error: errors };

  return {
    ok: true,
    value: {
      ...merged,
      uiLocale: resolveUiLocale(merged.uiLocale),
      selfAssessment: { ...merged.selfAssessment },
      interests: [...merged.interests],
    },
  };
}

export { CEFR_LEVELS, DEFAULT_LANGUAGE_PROFILE };
