import { describe, expect, it } from 'vitest';

import {
  learnerProfileSchema,
  onboardingInputSchema,
  schemaConstants,
} from '../src/schemas.js';

describe('zod schemas', () => {
  it('accepts a partial self-assessment', () => {
    const parsed = onboardingInputSchema.safeParse({
      goal: 'work',
      dailyMinutes: 20,
      timezone: 'Europe/Rome',
      interests: ['work'],
      selfAssessment: { grammar: 'B1' },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a profile with only some skills assessed', () => {
    const parsed = learnerProfileSchema.safeParse({
      id: 'profile-1',
      userId: 'user-1',
      targetLang: 'en',
      nativeLang: 'it',
      uiLocale: 'it',
      explanationMode: 'target_simple',
      proficiencyFramework: 'CEFR',
      proficiencyEstimate: null,
      goal: 'work',
      dailyMinutes: 20,
      streakMode: 'flexible',
      timezone: 'Europe/Rome',
      interests: ['work'],
      selfAssessment: { grammar: 'B1' },
      onboardingCompleted: true,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      deletedAt: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid CEFR levels', () => {
    const parsed = onboardingInputSchema.safeParse({
      goal: 'work',
      dailyMinutes: 20,
      timezone: 'Europe/Rome',
      interests: ['work'],
      selfAssessment: { grammar: 'C2' },
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps the A1-C1 content scope', () => {
    expect(schemaConstants.cefrLevels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });
});
