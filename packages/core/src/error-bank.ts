import type { SkillDomain } from './skills.js';

export const ERROR_DRILL_THRESHOLD = 3;
export const ERROR_WINDOW_DAYS = 14;

export interface DrillCandidate {
  readonly itemId: string;
  readonly skill: SkillDomain;
}

export function shouldTriggerErrorDrill(previousOccurrences: number): boolean {
  return previousOccurrences + 1 >= ERROR_DRILL_THRESHOLD;
}

export function selectDrillItem(
  candidates: readonly DrillCandidate[],
  usedItemIds: ReadonlySet<string>,
  attemptedItemId: string,
  skill: SkillDomain,
): DrillCandidate | null {
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.skill === skill &&
        candidate.itemId !== attemptedItemId &&
        !usedItemIds.has(candidate.itemId),
    )
    .sort((first, second) => first.itemId.localeCompare(second.itemId));
  return eligible[0] ?? null;
}
