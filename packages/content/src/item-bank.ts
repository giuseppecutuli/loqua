import type { AssessmentItemType, CefrLevel, SkillDomain } from '@loqua/core';

import { CONCEPTS, type Concept } from './knowledge-graph.js';

export interface FoundationItem {
  readonly id: string;
  readonly conceptId: string;
  readonly skill: SkillDomain;
  readonly cefrLevel: CefrLevel;
  readonly type: AssessmentItemType;
  readonly prompt: string;
  readonly options: readonly { readonly id: string; readonly text: string }[];
  readonly correctOptionId: string;
  readonly explanation: string;
  readonly difficultyB: number;
  readonly topic: string;
  readonly register?: 'casual' | 'neutral' | 'formal';
  readonly tags: readonly string[];
}

export interface FoundationItemPack {
  readonly id: string;
  readonly items: readonly FoundationItem[];
}

const MIN_DIFFICULTY = -3;
const MAX_DIFFICULTY = 3;

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateFoundationItems(
  items: readonly FoundationItem[],
  concepts: readonly Concept[] = CONCEPTS,
): readonly string[] {
  const errors: string[] = [];
  const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));
  const ids = new Set<string>();
  const prompts = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
    ids.add(item.id);

    const concept = conceptsById.get(item.conceptId);
    if (!concept) {
      errors.push(`${item.id}: unknown concept ${item.conceptId}`);
    } else {
      if (concept.domain !== item.skill) {
        errors.push(`${item.id}: skill ${item.skill} does not match concept domain ${concept.domain}`);
      }
      if (concept.level !== item.cefrLevel) {
        errors.push(`${item.id}: level ${item.cefrLevel} does not match concept level ${concept.level}`);
      }
    }

    if (item.prompt.trim().length === 0) errors.push(`${item.id}: empty prompt`);
    const normalized = normalizePrompt(item.prompt);
    if (prompts.has(normalized)) errors.push(`${item.id}: duplicate prompt`);
    prompts.add(normalized);

    if (item.options.length < 2 || item.options.length > 5) {
      errors.push(`${item.id}: options must contain 2-5 entries`);
    }
    const optionIds = new Set<string>();
    const optionTexts = new Set<string>();
    for (const option of item.options) {
      if (optionIds.has(option.id)) errors.push(`${item.id}: duplicate option id ${option.id}`);
      optionIds.add(option.id);
      const text = option.text.trim().toLowerCase();
      if (text.length === 0) errors.push(`${item.id}: empty option text`);
      if (optionTexts.has(text)) errors.push(`${item.id}: duplicate option text`);
      optionTexts.add(text);
    }
    if (!optionIds.has(item.correctOptionId)) {
      errors.push(`${item.id}: correctOptionId not in options`);
    }

    if (item.explanation.trim().length === 0) errors.push(`${item.id}: empty explanation`);
    if (
      !Number.isFinite(item.difficultyB) ||
      item.difficultyB < MIN_DIFFICULTY ||
      item.difficultyB > MAX_DIFFICULTY
    ) {
      errors.push(`${item.id}: difficultyB outside ${MIN_DIFFICULTY}..${MAX_DIFFICULTY}`);
    }
    if (item.tags.length === 0) errors.push(`${item.id}: at least one tag required`);
  }

  return errors;
}
