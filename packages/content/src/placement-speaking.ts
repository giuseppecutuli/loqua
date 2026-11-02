import type { CefrLevel } from '@loqua/core';

export interface PlacementSpeakingTask {
  readonly id: string;
  readonly targetLang: string;
  readonly skillId: string;
  readonly prompt: string;
  readonly cefrTarget: CefrLevel;
  readonly minSeconds: number;
  readonly maxSeconds: number;
}

const TASKS: Record<string, readonly PlacementSpeakingTask[]> = {
  en: [
    {
      id: 'placement.speaking.en.1',
      targetLang: 'en',
      skillId: 'skill-en-speaking',
      prompt:
        'Describe a decision you made recently. Say what you decided, why, and how you felt about it. Speak for about 45 seconds.',
      cefrTarget: 'B1',
      minSeconds: 20,
      maxSeconds: 60,
    },
    {
      id: 'placement.speaking.en.2',
      targetLang: 'en',
      skillId: 'skill-en-speaking',
      prompt:
        'A colleague asks you to move a deadline. Explain your situation and suggest a solution. Speak for about 45 seconds.',
      cefrTarget: 'B1',
      minSeconds: 20,
      maxSeconds: 60,
    },
  ],
};

export function getPlacementSpeakingTasks(targetLang: string): readonly PlacementSpeakingTask[] {
  return TASKS[targetLang] ?? [];
}

export function getPlacementSpeakingTask(
  targetLang: string,
  index: number,
): PlacementSpeakingTask | null {
  return TASKS[targetLang]?.[index] ?? null;
}
