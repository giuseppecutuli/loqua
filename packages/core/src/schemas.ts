import { z } from 'zod';

import { CONSENT_KINDS } from './consent.js';
import { isIanaTimezone } from './dates.js';
import { DEVICE_PLATFORMS } from './devices.js';
import { EXPLANATION_MODES, SUPPORTED_UI_LOCALES, isLanguageTag } from './language.js';
import {
  GOALS,
  MAX_DAILY_MINUTES,
  MAX_INTERESTS,
  MAX_INTEREST_LENGTH,
  MIN_DAILY_MINUTES,
  STREAK_MODES,
} from './profile.js';
import { CEFR_LEVELS, SKILL_DOMAINS } from './skills.js';

export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);
export const skillDomainSchema = z.enum([
  'grammar',
  'vocabulary',
  'listening',
  'speaking',
  'reading',
  'writing',
  'pragmatics',
]);
export const goalSchema = z.enum(['work', 'travel', 'daily', 'comprehension', 'exam']);
export const streakModeSchema = z.enum(['daily', 'flexible', 'weekend_off']);
export const consentKindSchema = z.enum(['terms', 'privacy', 'voice', 'ai_processing', 'analytics']);
export const devicePlatformSchema = z.enum(['android', 'ios', 'web', 'desktop']);
export const explanationModeSchema = z.enum(['target_simple', 'native']);
export const uiLocaleSchema = z.enum(['it', 'en']);

export const languageProfileSchema = z
  .object({
    targetLang: z.string().refine(isLanguageTag, 'invalid language tag'),
    nativeLang: z.string().refine(isLanguageTag, 'invalid language tag'),
    uiLocale: uiLocaleSchema,
    explanationMode: explanationModeSchema,
    proficiencyFramework: z.string().min(1).max(40),
  })
  .refine((value) => value.targetLang !== value.nativeLang, {
    message: 'target and native languages must differ',
    path: ['nativeLang'],
  });

export const onboardingInputSchema = z.object({
  goal: goalSchema,
  dailyMinutes: z.number().int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
  timezone: z.string().refine(isIanaTimezone, 'invalid IANA timezone'),
  interests: z
    .array(z.string().trim().min(1).max(MAX_INTEREST_LENGTH))
    .min(1)
    .max(MAX_INTERESTS),
  selfAssessment: z.record(skillDomainSchema, cefrLevelSchema),
  streakMode: streakModeSchema.optional(),
});

export const learnerProfilePatchSchema = z
  .object({
    goal: goalSchema,
    dailyMinutes: z.number().int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
    timezone: z.string().refine(isIanaTimezone, 'invalid IANA timezone'),
    interests: z
      .array(z.string().trim().min(1).max(MAX_INTEREST_LENGTH))
      .min(1)
      .max(MAX_INTERESTS),
    streakMode: streakModeSchema,
    explanationMode: explanationModeSchema,
    uiLocale: uiLocaleSchema,
    selfAssessment: z.record(skillDomainSchema, cefrLevelSchema),
  })
  .partial();

export const learnerProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  targetLang: z.string().refine(isLanguageTag),
  nativeLang: z.string().refine(isLanguageTag),
  uiLocale: uiLocaleSchema,
  explanationMode: explanationModeSchema,
  proficiencyFramework: z.string().min(1),
  proficiencyEstimate: cefrLevelSchema.nullable(),
  goal: goalSchema.nullable(),
  dailyMinutes: z.number().int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
  streakMode: streakModeSchema,
  timezone: z.string().refine(isIanaTimezone),
  interests: z.array(z.string().min(1).max(MAX_INTEREST_LENGTH)).max(MAX_INTERESTS),
  selfAssessment: z.record(skillDomainSchema, cefrLevelSchema),
  onboardingCompleted: z.boolean(),
  createdAt: z.iso.datetime({ offset: false }),
  updatedAt: z.iso.datetime({ offset: false }),
  deletedAt: z.iso.datetime({ offset: false }).nullable(),
});

export const consentRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  kind: consentKindSchema,
  version: z.string().min(1),
  grantedAt: z.iso.datetime({ offset: false }).nullable(),
  revokedAt: z.iso.datetime({ offset: false }).nullable(),
  createdAt: z.iso.datetime({ offset: false }),
});

export const deviceSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  platform: devicePlatformSchema,
  name: z.string().max(80).nullable(),
  lastSeenAt: z.iso.datetime({ offset: false }).nullable(),
  revokedAt: z.iso.datetime({ offset: false }).nullable(),
  createdAt: z.iso.datetime({ offset: false }),
  updatedAt: z.iso.datetime({ offset: false }),
});

export const exportEnvelopeSchema = z.object({
  formatVersion: z.number().int().positive(),
  schemaVersion: z.string().min(1),
  exportedAt: z.iso.datetime({ offset: false }),
  userId: z.string().min(1),
  profile: learnerProfileSchema.nullable(),
  consents: z.array(consentRecordSchema),
  devices: z.array(deviceSchema),
  settings: z.record(z.string(), z.unknown()).nullable(),
  data: z.record(z.string(), z.unknown()),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
});

export const schemaConstants = {
  goals: GOALS,
  streakModes: STREAK_MODES,
  cefrLevels: CEFR_LEVELS,
  skillDomains: SKILL_DOMAINS,
  consentKinds: CONSENT_KINDS,
  devicePlatforms: DEVICE_PLATFORMS,
  explanationModes: EXPLANATION_MODES,
  uiLocales: SUPPORTED_UI_LOCALES,
} as const;
