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

export type ConversationTurnView = z.infer<typeof conversationTurnViewSchema>;
export type ConversationView = z.infer<typeof conversationViewSchema>;
export type ConversationReply = z.infer<typeof conversationReplySchema>;
export type ConversationScenarioView = z.infer<typeof conversationScenarioViewSchema>;
