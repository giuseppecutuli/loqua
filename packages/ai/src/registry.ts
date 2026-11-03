import { assessmentEvaluatePrompt } from './prompts/assessment.evaluate.js';
import { contentGeneratePrompt } from './prompts/content.generate.js';
import { conversationTurnPrompt } from './prompts/conversation.turn.js';
import { correctionEvaluatePrompt } from './prompts/correction.evaluate.js';
import { mediaExplainPrompt } from './prompts/media.explain.js';
import { mediaGuidePrompt } from './prompts/media.guide.js';
import { mediaReflectPrompt } from './prompts/media.reflect.js';
import type { ModelTier, OutputParser, PromptSpec } from './types.js';

export interface RegisteredPrompt {
  readonly id: string;
  readonly version: number;
  readonly modelTier: ModelTier;
  readonly temperature: number;
  readonly systemPrompt: string;
  readonly outputSchema: OutputParser<unknown>;
  parseInput(value: unknown): unknown;
  renderUser(value: unknown): string;
}

function toRegistered<TInput, TOutput>(spec: PromptSpec<TInput, TOutput>): RegisteredPrompt {
  return {
    id: spec.id,
    version: spec.version,
    modelTier: spec.modelTier,
    temperature: spec.temperature,
    systemPrompt: spec.systemPrompt,
    outputSchema: {
      safeParse: (value) => {
        const parsed = spec.outputSchema.safeParse(value);
        if (!parsed.success) return { success: false, error: { issues: parsed.error.issues } };
        return { success: true, data: parsed.data };
      },
    },
    parseInput: (value) => spec.inputSchema.parse(value),
    renderUser: (value) => spec.renderUser(spec.inputSchema.parse(value)),
  };
}

const PROMPTS: readonly RegisteredPrompt[] = [
  toRegistered(correctionEvaluatePrompt),
  toRegistered(assessmentEvaluatePrompt),
  toRegistered(conversationTurnPrompt),
  toRegistered(contentGeneratePrompt),
  toRegistered(mediaExplainPrompt),
  toRegistered(mediaGuidePrompt),
  toRegistered(mediaReflectPrompt),
];

const REGISTRY = new Map(PROMPTS.map((prompt) => [`${prompt.id}@${prompt.version}`, prompt]));

export function getPrompt(id: string, version: number): RegisteredPrompt {
  const prompt = REGISTRY.get(`${id}@${version}`);
  if (!prompt) throw new Error(`Unknown prompt: ${id}@${version}`);
  return prompt;
}

export function listPrompts(): readonly { readonly id: string; readonly version: number }[] {
  return PROMPTS.map((prompt) => ({ id: prompt.id, version: prompt.version }));
}
