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
    ...(item.audioText ? { audioText: item.audioText } : {}),
    options:
      item.answerMode === 'text' ||
      item.answerMode === 'order' ||
      ['transformation', 'word_order', 'dictation', 'reuse_lexicon', 'free_writing', 'roleplay', 'shadowing'].includes(
        item.type,
      )
        ? []
        : item.options,
    ...(item.answerMode ? { answerMode: item.answerMode } : {}),
    ...(item.wordBank ? { wordBank: item.wordBank } : {}),
  };
}
