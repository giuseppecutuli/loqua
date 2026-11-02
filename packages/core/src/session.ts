import type { SkillDomain } from './skills.js';

export const SESSION_DEFAULT_SIZE = 12;
export const SESSION_REVIEW_RATIO = 0.4;
export const SESSION_INPUT_RATIO = 0.3;
export const SESSION_PRODUCTION_RATIO = 0.3;
export const SESSION_MAX_ITEMS_PER_CONCEPT = 2;

export const PRODUCTION_SKILLS: readonly SkillDomain[] = ['speaking', 'writing'];

export const SESSION_BLOCK_KINDS = ['review', 'input', 'production'] as const;

export type SessionBlockKind = (typeof SESSION_BLOCK_KINDS)[number];

export const SESSION_RATIONALE_CODES = [
  'due_review',
  'weak_skill',
  'new_concept',
  'production_practice',
  'fallback_foundation',
  'error_drill',
] as const;

export type SessionRationaleCode = (typeof SESSION_RATIONALE_CODES)[number];

export interface SessionCandidate {
  readonly itemId: string;
  readonly skillId: string;
  readonly skill: SkillDomain;
  readonly conceptId: string;
  readonly difficultyB: number;
  readonly sourceType: 'review' | 'foundation';
  readonly dueAt?: string;
}

export interface DailySessionInput {
  readonly candidates: readonly SessionCandidate[];
  readonly knownConceptIds: readonly string[];
  readonly now: Date;
  readonly size?: number;
  readonly weakSkillIds?: readonly string[];
}

export interface SessionItem {
  readonly itemId: string;
  readonly skillId: string;
  readonly skill: SkillDomain;
  readonly conceptId: string;
  readonly difficultyB: number;
  readonly sourceType: 'review' | 'foundation';
  readonly block: SessionBlockKind;
  readonly rationale: SessionRationaleCode;
}

export interface SessionBlock {
  readonly kind: SessionBlockKind;
  readonly items: readonly SessionItem[];
  readonly count: number;
}

export interface SessionCounts {
  readonly review: number;
  readonly input: number;
  readonly production: number;
  readonly total: number;
  readonly fallback: number;
  readonly requested: Readonly<Record<SessionBlockKind, number>>;
}

export interface DailySession {
  readonly size: number;
  readonly blocks: readonly SessionBlock[];
  readonly items: readonly SessionItem[];
  readonly counts: SessionCounts;
  readonly rationaleCodes: readonly SessionRationaleCode[];
}

interface BucketedCandidate extends SessionCandidate {
  readonly block: SessionBlockKind;
}

function allocateQuotas(size: number): Record<SessionBlockKind, number> {
  const ratios: ReadonlyArray<readonly [SessionBlockKind, number]> = [
    ['review', SESSION_REVIEW_RATIO],
    ['input', SESSION_INPUT_RATIO],
    ['production', SESSION_PRODUCTION_RATIO],
  ];
  const quotas: Record<SessionBlockKind, number> = { review: 0, input: 0, production: 0 };
  let assigned = 0;
  const remainders = ratios.map(([kind, ratio], index) => {
    const exact = size * ratio;
    const base = Math.floor(exact);
    quotas[kind] = base;
    assigned += base;
    return { kind, remainder: exact - base, index };
  });
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let left = size - assigned;
  for (const entry of remainders) {
    if (left <= 0) break;
    quotas[entry.kind] += 1;
    left -= 1;
  }
  return quotas;
}

function isDue(candidate: SessionCandidate, nowMs: number): boolean {
  if (candidate.sourceType !== 'review') return true;
  if (candidate.dueAt === undefined) return true;
  const dueAt = Date.parse(candidate.dueAt);
  return Number.isFinite(dueAt) && dueAt <= nowMs;
}

function naturalBlock(candidate: SessionCandidate): SessionBlockKind {
  if (candidate.sourceType === 'review') return 'review';
  return PRODUCTION_SKILLS.includes(candidate.skill) ? 'production' : 'input';
}

function compareCandidates(first: SessionCandidate, second: SessionCandidate): number {
  if (first.itemId !== second.itemId) return first.itemId.localeCompare(second.itemId);
  if (first.sourceType !== second.sourceType) {
    return first.sourceType === 'review' ? -1 : 1;
  }
  if (first.skillId !== second.skillId) return first.skillId.localeCompare(second.skillId);
  if (first.conceptId !== second.conceptId) return first.conceptId.localeCompare(second.conceptId);
  return first.difficultyB - second.difficultyB;
}

function dedupeCandidates(candidates: readonly SessionCandidate[]): readonly SessionCandidate[] {
  const byItemId = new Map<string, SessionCandidate>();
  for (const candidate of candidates) {
    const existing = byItemId.get(candidate.itemId);
    if (!existing || compareCandidates(candidate, existing) < 0) {
      byItemId.set(candidate.itemId, candidate);
    }
  }
  return [...byItemId.values()].sort(compareCandidates);
}

function dueAtMs(candidate: SessionCandidate): number {
  if (candidate.dueAt === undefined) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(candidate.dueAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function orderBucket(candidates: readonly BucketedCandidate[]): readonly BucketedCandidate[] {
  return candidates.slice().sort((first, second) => {
    if (first.block === 'review' && second.block === 'review') {
      const dueDiff = dueAtMs(first) - dueAtMs(second);
      if (dueDiff !== 0) return dueDiff;
    }
    if (first.difficultyB !== second.difficultyB) return first.difficultyB - second.difficultyB;
    return first.itemId.localeCompare(second.itemId);
  });
}

function rationaleFor(
  candidate: BucketedCandidate,
  weakSkillIds: ReadonlySet<string>,
  fallback: boolean,
): SessionRationaleCode {
  if (weakSkillIds.has(candidate.skillId)) return 'weak_skill';
  if (candidate.block === 'review') return 'due_review';
  if (candidate.block === 'production') return 'production_practice';
  return fallback ? 'fallback_foundation' : 'new_concept';
}

export function buildDailySession(input: DailySessionInput): DailySession {
  const size = input.size ?? SESSION_DEFAULT_SIZE;
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError('session size must be a non-negative integer');
  }

  const nowMs = input.now.getTime();
  const knownConcepts = new Set(input.knownConceptIds);
  const weakSkillIds = new Set(input.weakSkillIds ?? []);
  const quotas = allocateQuotas(size);
  const buckets: Record<SessionBlockKind, BucketedCandidate[]> = {
    review: [],
    input: [],
    production: [],
  };

  for (const candidate of dedupeCandidates(input.candidates)) {
    if (knownConcepts.has(candidate.conceptId)) continue;
    if (!isDue(candidate, nowMs)) continue;
    const block = naturalBlock(candidate);
    buckets[block].push({ ...candidate, block });
  }

  const ordered: Record<SessionBlockKind, readonly BucketedCandidate[]> = {
    review: orderBucket(buckets.review),
    input: orderBucket(buckets.input),
    production: orderBucket(buckets.production),
  };

  const selected: SessionItem[] = [];
  const usedItemIds = new Set<string>();
  const conceptCounts = new Map<string, number>();
  let fallbackCount = 0;

  const canSelect = (candidate: BucketedCandidate): boolean => {
    if (usedItemIds.has(candidate.itemId)) return false;
    return (conceptCounts.get(candidate.conceptId) ?? 0) < SESSION_MAX_ITEMS_PER_CONCEPT;
  };

  const select = (candidate: BucketedCandidate, fallback: boolean): void => {
    usedItemIds.add(candidate.itemId);
    conceptCounts.set(candidate.conceptId, (conceptCounts.get(candidate.conceptId) ?? 0) + 1);
    if (fallback) fallbackCount += 1;
    selected.push({
      itemId: candidate.itemId,
      skillId: candidate.skillId,
      skill: candidate.skill,
      conceptId: candidate.conceptId,
      difficultyB: candidate.difficultyB,
      sourceType: candidate.sourceType,
      block: candidate.block,
      rationale: rationaleFor(candidate, weakSkillIds, fallback),
    });
  };

  for (const kind of SESSION_BLOCK_KINDS) {
    const quota = quotas[kind];
    let taken = 0;
    for (const candidate of ordered[kind]) {
      if (taken >= quota) break;
      if (!canSelect(candidate)) continue;
      select(candidate, false);
      taken += 1;
    }
  }

  if (selected.length < size) {
    for (const kind of SESSION_BLOCK_KINDS) {
      for (const candidate of ordered[kind]) {
        if (selected.length >= size) break;
        if (!canSelect(candidate)) continue;
        select(candidate, true);
      }
    }
  }

  const blocks: SessionBlock[] = SESSION_BLOCK_KINDS.map((kind) => {
    const items = selected.filter((item) => item.block === kind);
    return { kind, items, count: items.length };
  });
  const rationales = new Set(selected.map((item) => item.rationale));
  const rationaleCodes = SESSION_RATIONALE_CODES.filter((code) => rationales.has(code));

  return {
    size,
    blocks,
    items: selected,
    counts: {
      review: blocks[0]?.count ?? 0,
      input: blocks[1]?.count ?? 0,
      production: blocks[2]?.count ?? 0,
      total: selected.length,
      fallback: fallbackCount,
      requested: quotas,
    },
    rationaleCodes,
  };
}
