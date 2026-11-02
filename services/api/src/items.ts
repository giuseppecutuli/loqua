import type { AssessmentItem, PlacementItem } from '@loqua/core';

export function toPublicItem(item: AssessmentItem): PlacementItem {
  return {
    id: item.id,
    targetLang: item.targetLang,
    type: item.type,
    skill: item.skill,
    skillId: item.skillId,
    cefrLevel: item.cefrLevel,
    conceptId: item.conceptId,
    difficultyB: item.difficultyB,
    prompt: item.prompt,
    options: item.options,
  };
}
