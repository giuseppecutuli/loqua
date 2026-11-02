import { ALL_CONCEPTS, RULES } from '@loqua/content';
import {
  AiGatewayError,
  contentGenerateOutputSchema,
  type AiGateway,
  type ContentGenerateOutput,
} from '@loqua/ai';
import {
  canProcessAi,
  generateUuidV7,
  type AssessmentItem,
  type CefrLevel,
  type SkillDomain,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { toPublicItem } from '../items.js';
import type { AccountRepository } from '../repos/account.js';
import type { AssessmentStore } from '../repos/assessment.js';
import type { SessionStore } from '../repos/session.js';

export interface ContentRoutesDeps {
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

const GENERATION_DAILY_CAP = 10;
const GENERATION_TTL_MS = 7 * 86_400_000;
const GENERATION_TYPES = [
  'cloze',
  'transformation',
  'word_order',
  'dictation',
  'listening_mcq',
  'reading_mcq',
  'reuse_lexicon',
  'error_spotting',
] as const;

const generateSchema = z.object({
  skill: z.enum(['grammar', 'vocabulary', 'listening', 'reading', 'pragmatics']),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1']),
  conceptId: z.string().min(1).max(120),
  types: z.array(z.enum(GENERATION_TYPES)).min(1).max(8).optional(),
  count: z.number().int().min(1).max(3).default(1),
  topic: z.string().trim().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toItem(
  draft: ContentGenerateOutput['items'][number],
  input: z.infer<typeof generateSchema>,
): AssessmentItem | null {
  if (!draft.selfCheck.uniqueAnswer || draft.selfCheck.ambiguous || !draft.selfCheck.cefrAppropriate) {
    return null;
  }
  if (draft.skill !== input.skill || draft.cefrLevel !== input.cefrLevel) return null;
  if (draft.conceptId !== input.conceptId) return null;
  if (!GENERATION_TYPES.includes(draft.type as (typeof GENERATION_TYPES)[number])) return null;
  if (input.types && !input.types.includes(draft.type as (typeof GENERATION_TYPES)[number])) return null;
  if (!draft.options.some((option) => option.id === draft.correctOptionId)) return null;
  if (draft.ruleId !== null && !RULES.some((rule) => rule.id === draft.ruleId)) return null;
  if (draft.answerMode === 'order' && (!draft.wordBank || draft.wordBank.length < 2)) return null;
  if (input.skill === 'listening' && !draft.audioText) return null;
  if (input.skill !== 'listening' && draft.audioText) return null;

  return {
    id: generateUuidV7(),
    targetLang: 'en',
    type: draft.type as AssessmentItem['type'],
    skill: draft.skill as SkillDomain as AssessmentItem['skill'],
    skillId: `skill-en-${draft.skill}`,
    cefrLevel: draft.cefrLevel as CefrLevel,
    conceptId: draft.conceptId,
    difficultyB: draft.difficultyB,
    prompt: draft.prompt,
    ...(draft.audioText ? { audioText: draft.audioText } : {}),
    ...(draft.answerMode !== 'mcq' ? { answerMode: draft.answerMode } : {}),
    ...(draft.wordBank ? { wordBank: draft.wordBank } : {}),
    options: draft.options,
    correctOptionId: draft.correctOptionId,
    explanation: draft.explanation,
  };
}

export function createContentRoutes(deps: ContentRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post('/generate', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid generation payload'), 400);
    }
    const input = parsed.data;
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }

    const concept = ALL_CONCEPTS.find((entry) => entry.id === input.conceptId);
    if (!concept || concept.level !== input.cefrLevel || concept.domain !== input.skill) {
      return c.json(errorResponse('invalid_concept', 'Unknown or mismatched concept'), 400);
    }
    const known = await deps.sessions.getConceptState(user.id, input.conceptId);
    if (known && known.mastery >= 0.85) {
      return c.json(errorResponse('concept_known', 'Concept is already mastered'), 409);
    }
    const rule = RULES.find((entry) => entry.id === input.conceptId);
    const now = deps.now();
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    if ((await deps.assessments.countGeneratedItems(user.id, since)) >= GENERATION_DAILY_CAP) {
      return c.json(errorResponse('generation_cap', 'Daily generation cap reached'), 429);
    }

    try {
      const response = await deps.ai.call({
        promptId: 'content.generate',
        promptVersion: 1,
        tier: 'fast',
        input: {
          targetLang: snapshot.profile.targetLang,
          nativeLang: snapshot.profile.nativeLang,
          explanationMode: snapshot.profile.explanationMode,
          proficiencyFramework: snapshot.profile.proficiencyFramework,
          conceptId: concept.id,
          conceptLabel: concept.title,
          referenceExplanation: concept.description,
          ruleId: rule?.id ?? null,
          skill: input.skill,
          cefrLevel: input.cefrLevel,
          types: input.types ?? [...GENERATION_TYPES],
          count: input.count,
          topic: input.topic ?? null,
          tags: input.tags ?? snapshot.profile.interests,
          avoidPhrases: [],
        },
        schema: contentGenerateOutputSchema,
        userId: user.id,
        maxRepairs: 1,
      });

      if (!response.data.batchSelfCheck.allUniqueAnswers || !response.data.batchSelfCheck.noDuplicates) {
        return c.json(errorResponse('generation_rejected', 'Batch self-check failed'), 422);
      }

      const accepted: AssessmentItem[] = [];
      const seen = new Set<string>();
      const expiresAt = new Date(now.getTime() + GENERATION_TTL_MS).toISOString();
      for (const draft of response.data.items) {
        const item = toItem(draft, input);
        if (!item) continue;
        const normalized = normalizePrompt(item.prompt);
        if (seen.has(normalized)) continue;
        const existing = await deps.assessments.findGeneratedItemByPrompt(user.id, normalized);
        if (existing) continue;
        seen.add(normalized);
        await deps.assessments.insertGeneratedItem({
          item,
          ownerUserId: user.id,
          profileId: snapshot.profile.id,
          nativeLang: snapshot.profile.nativeLang,
          expiresAt,
          promptId: 'content.generate',
          promptVersion: 1,
          generationReason: 'content.generate',
          createdAt: now.toISOString(),
        });
        accepted.push(item);
      }
      if (accepted.length === 0) {
        return c.json(errorResponse('generation_rejected', 'No item passed validation'), 422);
      }
      return c.json({
        items: accepted.map((item) => ({ ...toPublicItem(item), expiresAt })),
      }, 201);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        const status =
          error.code === 'budget_blocked'
            ? 402
            : error.code === 'invalid_input' || error.code === 'unknown_prompt'
              ? 400
              : 502;
        return c.json(errorResponse(error.code, error.message), status);
      }
      return c.json(errorResponse('provider_error', 'Content generation failed'), 502);
    }
  });

  return app;
}
