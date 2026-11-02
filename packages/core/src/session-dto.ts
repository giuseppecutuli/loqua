import { z } from 'zod';

import { placementFeedbackSchema, placementItemSchema } from './assessment.js';
import { SESSION_BLOCK_KINDS } from './session.js';

export const sessionStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'abandoned']);

export const sessionItemViewSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  block: z.enum(SESSION_BLOCK_KINDS),
  rationale: z.string().min(1),
  status: z.enum(['pending', 'answered', 'skipped']),
  item: placementItemSchema,
});

export const sessionViewSchema = z.object({
  id: z.string().min(1),
  status: sessionStatusSchema,
  total: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  current: sessionItemViewSchema.nullable(),
});

export const sessionAttemptResponseSchema = z.object({
  session: sessionViewSchema,
  feedback: placementFeedbackSchema,
});

export type SessionView = z.infer<typeof sessionViewSchema>;
export type SessionItemView = z.infer<typeof sessionItemViewSchema>;
export type SessionAttemptResponse = z.infer<typeof sessionAttemptResponseSchema>;
