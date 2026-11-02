import { z } from 'zod';

export const FEEDBACK_TARGET_TYPES = [
  'exercise',
  'correction',
  'session',
  'media',
  'app',
] as const;

export const FEEDBACK_KINDS = [
  'helpful',
  'not_helpful',
  'wrong',
  'too_easy',
  'too_hard',
  'report',
] as const;

export const FEEDBACK_STATUSES = ['open', 'reviewed', 'resolved'] as const;

export const feedbackSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  profileId: z.string().min(1),
  targetType: z.enum(FEEDBACK_TARGET_TYPES),
  targetId: z.string().min(1).max(120).nullable(),
  kind: z.enum(FEEDBACK_KINDS),
  comment: z.string().max(1000).nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  createdAt: z.iso.datetime({ offset: false }),
  resolvedAt: z.iso.datetime({ offset: false }).nullable(),
});

export type Feedback = z.infer<typeof feedbackSchema>;
export type FeedbackTargetType = (typeof FEEDBACK_TARGET_TYPES)[number];
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export interface CreateFeedbackInput {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly targetType: FeedbackTargetType;
  readonly targetId?: string | null;
  readonly kind: FeedbackKind;
  readonly comment?: string | null;
  readonly now: Date;
}

export function createFeedback(input: CreateFeedbackInput): Feedback {
  return {
    id: input.id,
    userId: input.userId,
    profileId: input.profileId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    kind: input.kind,
    comment: input.comment?.trim() || null,
    status: 'open',
    createdAt: input.now.toISOString(),
    resolvedAt: null,
  };
}
