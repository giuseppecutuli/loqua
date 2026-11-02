import type { WritingTask } from '@loqua/core';

const TASKS: Record<string, WritingTask> = {
  en: {
    id: 'placement.writing.en.v1',
    targetLang: 'en',
    skillId: 'skill-en-writing',
    prompt:
      'Write about a decision you made recently. Explain what you decided and why. Aim for about 60-120 words.',
    minWords: 40,
    maxWords: 180,
    cefrTarget: 'B1',
  },
};

export function getPlacementWritingTask(targetLang: string): WritingTask | null {
  return TASKS[targetLang] ?? null;
}
