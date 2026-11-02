import type { SkillDomain } from './skills.js';

export const ERROR_DRILL_THRESHOLD = 3;
export const ERROR_WINDOW_DAYS = 14;

export interface DrillCandidate {
  readonly itemId: string;
  readonly skill: SkillDomain;
  readonly conceptId: string;
}

export function shouldTriggerErrorDrill(previousOccurrences: number): boolean {
  return previousOccurrences + 1 >= ERROR_DRILL_THRESHOLD;
}

export function selectDrillItem(
  candidates: readonly DrillCandidate[],
  usedItemIds: ReadonlySet<string>,
  attemptedItemId: string,
  skill: SkillDomain,
  conceptId?: string,
): DrillCandidate | null {
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.skill === skill &&
        candidate.itemId !== attemptedItemId &&
        !usedItemIds.has(candidate.itemId),
    )
    .sort((first, second) => first.itemId.localeCompare(second.itemId));
  const sameConcept = conceptId
    ? eligible.filter((candidate) => candidate.conceptId === conceptId)
    : [];
  return sameConcept[0] ?? eligible[0] ?? null;
}
