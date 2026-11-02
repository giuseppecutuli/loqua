export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const SKILL_DOMAINS = [
  'grammar',
  'vocabulary',
  'listening',
  'speaking',
  'reading',
  'writing',
  'pragmatics',
] as const;

export type SkillDomain = (typeof SKILL_DOMAINS)[number];

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
};

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === 'string' && (CEFR_LEVELS as readonly string[]).includes(value);
}

export function isSkillDomain(value: unknown): value is SkillDomain {
  return typeof value === 'string' && (SKILL_DOMAINS as readonly string[]).includes(value);
}

export function cefrRank(level: CefrLevel): number {
  return CEFR_RANK[level];
}

export function isAtLeast(actual: CefrLevel, required: CefrLevel): boolean {
  return cefrRank(actual) >= cefrRank(required);
}

export function nextCefrLevel(level: CefrLevel): CefrLevel | null {
  const index = CEFR_LEVELS.indexOf(level);
  return CEFR_LEVELS[index + 1] ?? null;
}

export function previousCefrLevel(level: CefrLevel): CefrLevel | null {
  const index = CEFR_LEVELS.indexOf(level);
  return index > 0 ? (CEFR_LEVELS[index - 1] ?? null) : null;
}

export const CEFR_THETA_CENTERS: Record<CefrLevel, number> = {
  A1: -2,
  A2: -1,
  B1: 0.1,
  B2: 1.25,
  C1: 2.2,
};

const CEFR_THETA_BOUNDARIES: ReadonlyArray<{ readonly max: number; readonly level: CefrLevel }> = [
  { max: -1.5, level: 'A1' },
  { max: -0.5, level: 'A2' },
  { max: 0.7, level: 'B1' },
  { max: 1.8, level: 'B2' },
];

export function thetaFromCefr(level: CefrLevel): number {
  return CEFR_THETA_CENTERS[level];
}

export function cefrFromTheta(theta: number): CefrLevel {
  for (const boundary of CEFR_THETA_BOUNDARIES) {
    if (theta < boundary.max) return boundary.level;
  }
  return 'C1';
}

export function cefrRangeLabel(low: number, high: number): string {
  const from = cefrFromTheta(low);
  const to = cefrFromTheta(high);
  return from === to ? from : `${from}/${to}`;
}
