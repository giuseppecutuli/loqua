import { describe, expect, it } from 'vitest';

import {
  createLearnerProfile,
  isOnboardingComplete,
  nextOnboardingStep,
  updateLearnerProfile,
  validateOnboarding,
  type OnboardingInput,
} from '../src/profile.js';

const input: OnboardingInput = {
  goal: 'work',
  dailyMinutes: 20,
  timezone: 'Europe/Rome',
  interests: ['technology', 'travel', 'Technology'],
  selfAssessment: { grammar: 'B1', speaking: 'A2' },
};

describe('onboarding', () => {
  it('normalizes and validates input', () => {
    const result = validateOnboarding(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.interests).toEqual(['technology', 'travel']);
      expect(result.value.streakMode).toBe('flexible');
    }
  });

  it('rejects out-of-range daily minutes and bad timezone', () => {
    const result = validateOnboarding({ ...input, dailyMinutes: 2, timezone: 'Mars/Olympus' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.map((error) => error.code)).toEqual([
        'daily_minutes_invalid',
        'timezone_invalid',
      ]);
    }
  });

  it('creates a complete profile', () => {
    const result = createLearnerProfile(input, {
      id: 'profile-1',
      userId: 'user-1',
      now: new Date('2026-11-01T10:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.onboardingCompleted).toBe(true);
      expect(result.value.uiLocale).toBe('it');
      expect(isOnboardingComplete(result.value)).toBe(true);
      expect(result.value.createdAt).toBe('2026-11-01T10:00:00.000Z');
    }
  });

  it('advances onboarding steps', () => {
    expect(nextOnboardingStep('goal')).toBe('time');
    expect(nextOnboardingStep('interests')).toBeNull();
  });

  it('updates profile fields without losing language settings', () => {
    const created = createLearnerProfile(input, {
      id: 'profile-1',
      userId: 'user-1',
      now: new Date('2026-11-01T10:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = updateLearnerProfile(
      created.value,
      { dailyMinutes: 30, interests: ['music'] },
      new Date('2026-11-01T11:00:00.000Z'),
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.dailyMinutes).toBe(30);
      expect(updated.value.interests).toEqual(['music']);
      expect(updated.value.targetLang).toBe('en');
      expect(updated.value.updatedAt).toBe('2026-11-01T11:00:00.000Z');
    }
  });
});
