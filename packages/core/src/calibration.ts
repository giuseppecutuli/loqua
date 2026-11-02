export const MIN_CALIBRATION_ATTEMPTS = 100;
export const RETIRE_HIGH_P = 0.95;
export const RETIRE_LOW_P = 0.15;
export const MIN_DIFFICULTY_B = -3;
export const MAX_DIFFICULTY_B = 3;

const BLEND_WEIGHT = 0.5;
const DEFAULT_P = 0.5;
const PRECISION = 1000;

export interface ItemAttemptStats {
  readonly itemId: string;
  readonly attempts: number;
  readonly correct: number;
  readonly pValue?: number;
  readonly discrimination?: number;
  readonly difficultyB?: number;
}

export interface ItemCalibration {
  readonly itemId: string;
  readonly difficultyB: number;
  readonly retire: boolean;
  readonly flag: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

export function pValueFromStats(stats: Pick<ItemAttemptStats, 'attempts' | 'correct'>): number {
  return stats.attempts > 0 ? stats.correct / stats.attempts : DEFAULT_P;
}

export function difficultyFromPValue(pValue: number): number {
  const p = clamp(pValue, 0, 1);
  return clamp(-Math.log(p / (1 - p)), MIN_DIFFICULTY_B, MAX_DIFFICULTY_B);
}

export function calibrateItem(stats: ItemAttemptStats): ItemCalibration {
  const pValue = stats.pValue ?? pValueFromStats(stats);
  const targetDifficulty = difficultyFromPValue(pValue);
  const currentDifficulty = clamp(stats.difficultyB ?? 0, MIN_DIFFICULTY_B, MAX_DIFFICULTY_B);
  const difficultyB = round(
    (1 - BLEND_WEIGHT) * currentDifficulty + BLEND_WEIGHT * targetDifficulty,
  );
  const retire =
    stats.attempts >= MIN_CALIBRATION_ATTEMPTS && (pValue > RETIRE_HIGH_P || pValue < RETIRE_LOW_P);
  const flag = stats.discrimination !== undefined && stats.discrimination < 0;

  return { itemId: stats.itemId, difficultyB, retire, flag };
}
