import { z } from 'zod';

import { cefrLevelSchema } from './schemas.js';

export const conversationTurnViewSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'tutor', 'system']),
  content: z.string().min(1).max(4000),
  createdAt: z.iso.datetime({ offset: false }),
});

export const conversationViewSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  level: cefrLevelSchema,
  status: z.enum(['planned', 'in_progress', 'completed', 'abandoned']),
  maxTurns: z.number().int().positive(),
  turns: z.array(conversationTurnViewSchema),
});

export const conversationReplySchema = z.object({
  session: conversationViewSchema,
  reply: z.string().min(1).max(2000),
  hint: z.string().max(500).nullable(),
  done: z.boolean(),
  transcript: z.string().min(1).max(2000).optional(),
  meta: z
    .object({
      latencyMs: z.number().int().nonnegative(),
      costUsd: z.number().nonnegative(),
      tokensIn: z.number().int().nonnegative(),
      tokensOut: z.number().int().nonnegative(),
    })
    .optional(),
});

export const conversationScenarioViewSchema = z.object({
  id: z.string().min(1),
  level: cefrLevelSchema,
  title: z.string().min(1),
  setting: z.string().min(1),
  goal: z.string().min(1),
  learnerRole: z.string().min(1),
  tutorRole: z.string().min(1),
  register: z.enum(['casual', 'neutral', 'formal']),
  targetPhrases: z.array(z.string().min(1)),
  openingLine: z.string().min(1),
  maxTurns: z.number().int().positive(),
});

export const conversationReportSchema = z.object({
  corrections: z.array(
    z.object({
      span: z.string().min(1).max(400),
      errorType: z.string().min(1).max(60),
      ruleId: z.string().min(1).max(120),
      severity: z.enum(['low', 'medium', 'high']),
      confidence: z.number().min(0.7).max(1),
      explanation: z.string().min(1).max(400),
    }),
  ),
  focusPoints: z.array(z.string().min(1).max(300)).max(3),
  usefulPhrases: z.array(z.string().min(1).max(300)).max(8),
});

export const CONVERSATION_INJECTION_PATTERNS = [
  /ignore (all )?(previous|above) instructions/i,
  /reveal (your|the) (system )?prompt/i,
  /system prompt/i,
  /developer message/i,
  /jailbreak/i,
  /you are now (an?|the) /i,
  /act as (an?|the) (system|developer)/i,
];

export const CONVERSATION_UNSAFE_PATTERNS = [
  /\b(kill|murder) (yourself|him|her|them)\b/i,
  /\bchild sexual\b/i,
  /\bmake a bomb\b/i,
  /\bhow to (hack|steal)\b/i,
];

export function isPromptInjection(text: string): boolean {
  return CONVERSATION_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isUnsafeConversationText(text: string): boolean {
  return CONVERSATION_UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

export type ConversationReport = z.infer<typeof conversationReportSchema>;

export type ConversationTurnView = z.infer<typeof conversationTurnViewSchema>;
export type ConversationView = z.infer<typeof conversationViewSchema>;
export type ConversationReply = z.infer<typeof conversationReplySchema>;
export type ConversationScenarioView = z.infer<typeof conversationScenarioViewSchema>;

export interface ConversationContextTurn {
  readonly role: 'user' | 'tutor' | 'system';
  readonly content: string;
}

export interface ConversationContextOptions {
  readonly maxRecentTurns?: number;
  readonly maxChars?: number;
}

export interface ConversationContext {
  readonly recentTurns: readonly {
    readonly role: 'learner' | 'tutor';
    readonly content: string;
  }[];
  readonly olderSummary: string | null;
  readonly estimatedTokens: number;
  readonly truncated: boolean;
}

export function buildConversationContext(
  turns: readonly ConversationContextTurn[],
  options: ConversationContextOptions = {},
): ConversationContext {
  const filtered = turns
    .filter((turn) => turn.role === 'user' || turn.role === 'tutor')
    .map((turn) => ({
      role: turn.role === 'user' ? ('learner' as const) : ('tutor' as const),
      content: turn.content.trim(),
    }))
    .filter((turn) => turn.content.length > 0);
  const maxRecentTurns = Math.max(1, Math.min(8, options.maxRecentTurns ?? 8));
  const maxChars = Math.max(1_000, Math.min(12_000, options.maxChars ?? 6_000));
  const older = filtered.slice(0, Math.max(0, filtered.length - maxRecentTurns));
  const recent = filtered.slice(-maxRecentTurns);

  const learnerHighlights = older
    .filter((turn) => turn.role === 'learner')
    .slice(-2)
    .map((turn) => turn.content.slice(0, 180));
  const tutorHighlight = older.filter((turn) => turn.role === 'tutor').at(-1);
  const summaryParts: string[] = [];
  if (learnerHighlights.length > 0) {
    summaryParts.push(`Learner earlier: ${learnerHighlights.join(' | ')}`);
  }
  if (tutorHighlight) {
    summaryParts.push(`Tutor earlier: ${tutorHighlight.content.slice(0, 180)}`);
  }
  const olderSummary = summaryParts.length > 0 ? summaryParts.join(' ').slice(0, 1_200) : null;

  let remaining = maxChars - (olderSummary?.length ?? 0);
  const kept: { role: 'learner' | 'tutor'; content: string }[] = [];
  let truncated = false;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const turn = recent[index];
    if (!turn) continue;
    const content = turn.content.slice(0, 1_200);
    if (content.length > remaining) {
      truncated = true;
      break;
    }
    kept.unshift({ role: turn.role, content });
    remaining -= content.length;
  }
  if (kept.length === 0 && recent.length > 0) {
    const last = recent[recent.length - 1];
    if (last) {
      kept.push({ role: last.role, content: last.content.slice(0, Math.max(200, remaining)) });
      truncated = true;
    }
  }

  const totalChars =
    (olderSummary?.length ?? 0) + kept.reduce((sum, turn) => sum + turn.content.length, 0);
  return {
    recentTurns: kept,
    olderSummary,
    estimatedTokens: Math.ceil(totalChars / 4),
    truncated,
  };
}