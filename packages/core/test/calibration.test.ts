import { describe, expect, it } from 'vitest';

import {
  MAX_DIFFICULTY_B,
  MIN_CALIBRATION_ATTEMPTS,
  MIN_DIFFICULTY_B,
  RETIRE_HIGH_P,
  RETIRE_LOW_P,
  calibrateItem,
  difficultyFromPValue,
  pValueFromStats,
  type ItemAttemptStats,
} from '../src/calibration.js';

function stats(overrides: Partial<ItemAttemptStats> = {}): ItemAttemptStats {
  return { itemId: 'en.gram.test', attempts: 100, correct: 50, ...overrides };
}

describe('calibration p-value and difficulty', () => {
  it('computes the p-value from attempts when it is not supplied', () => {
    expect(pValueFromStats({ attempts: 100, correct: 75 })).toBe(0.75);
    expect(pValueFromStats({ attempts: 0, correct: 0 })).toBe(0.5);
  });

  it('prefers an explicit p-value over correct / attempts', () => {
    const calibrated = calibrateItem(stats({ correct: 0, pValue: RETIRE_HIGH_P + 0.02 }));
    expect(calibrated.difficultyB).toBeLessThan(0);
    expect(calibrated.retire).toBe(true);
  });

  it('blends the new difficulty with the current item difficulty', () => {
    expect(calibrateItem(stats({ correct: 75 })).difficultyB).toBeCloseTo(-0.549, 3);
    expect(calibrateItem(stats({ attempts: 100, correct: 50, difficultyB: 2 })).difficultyB).toBe(
      1,
    );
    expect(calibrateItem(stats({ attempts: 100, correct: 50, difficultyB: -2 })).difficultyB).toBe(
      -1,
    );
  });

  it('clamps the target difficulty to the supported range', () => {
    expect(difficultyFromPValue(0)).toBe(MAX_DIFFICULTY_B);
    expect(difficultyFromPValue(1)).toBe(MIN_DIFFICULTY_B);
    expect(difficultyFromPValue(-0.5)).toBe(MAX_DIFFICULTY_B);
    expect(difficultyFromPValue(1.5)).toBe(MIN_DIFFICULTY_B);
    expect(calibrateItem(stats({ pValue: 0, difficultyB: MAX_DIFFICULTY_B })).difficultyB).toBe(
      MAX_DIFFICULTY_B,
    );
    expect(calibrateItem(stats({ pValue: 1, difficultyB: MIN_DIFFICULTY_B })).difficultyB).toBe(
      MIN_DIFFICULTY_B,
    );
    for (const pValue of [0, 0.01, 0.5, 0.99, 1]) {
      const calibrated = calibrateItem(stats({ pValue }));
      expect(calibrated.difficultyB).toBeGreaterThanOrEqual(MIN_DIFFICULTY_B);
      expect(calibrated.difficultyB).toBeLessThanOrEqual(MAX_DIFFICULTY_B);
    }
  });

  it('returns the same value for the same stats', () => {
    const input = stats({ correct: 73, attempts: 140, difficultyB: 0.4, discrimination: -0.2 });
    expect(calibrateItem(input)).toEqual(calibrateItem(input));
  });
});

describe('calibration retirement', () => {
  it('requires the minimum number of attempts before retiring', () => {
    expect(MIN_CALIBRATION_ATTEMPTS).toBe(100);
    expect(calibrateItem(stats({ attempts: 99, pValue: 1 })).retire).toBe(false);
    expect(calibrateItem(stats({ attempts: 99, pValue: 0 })).retire).toBe(false);
    expect(calibrateItem(stats({ attempts: 100, pValue: 1 })).retire).toBe(true);
  });

  it('retires outside the p-value boundaries but not exactly on them', () => {
    expect(RETIRE_HIGH_P).toBe(0.95);
    expect(RETIRE_LOW_P).toBe(0.15);
    expect(calibrateItem(stats({ pValue: RETIRE_HIGH_P })).retire).toBe(false);
    expect(calibrateItem(stats({ pValue: RETIRE_HIGH_P + 0.0001 })).retire).toBe(true);
    expect(calibrateItem(stats({ pValue: RETIRE_LOW_P })).retire).toBe(false);
    expect(calibrateItem(stats({ pValue: RETIRE_LOW_P - 0.0001 })).retire).toBe(true);
  });
});

describe('calibration discrimination flag', () => {
  it('flags only negative discrimination', () => {
    expect(calibrateItem(stats({ discrimination: -0.01 })).flag).toBe(true);
    expect(calibrateItem(stats({ discrimination: 0 })).flag).toBe(false);
    expect(calibrateItem(stats({ discrimination: 1.2 })).flag).toBe(false);
    expect(calibrateItem(stats()).flag).toBe(false);
  });
});
