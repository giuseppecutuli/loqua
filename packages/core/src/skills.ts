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
