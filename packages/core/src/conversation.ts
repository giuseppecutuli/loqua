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

export type ConversationReport = z.infer<typeof conversationReportSchema>;

export type ConversationTurnView = z.infer<typeof conversationTurnViewSchema>;
export type ConversationView = z.infer<typeof conversationViewSchema>;
export type ConversationReply = z.infer<typeof conversationReplySchema>;
export type ConversationScenarioView = z.infer<typeof conversationScenarioViewSchema>;
