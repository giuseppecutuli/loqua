import { z } from 'zod';

import { isUtcIso } from './dates.js';
import { err, ok, type Result } from './result.js';

export const PRODUCT_EVENT_NAMES = [
  'app_open',
  'onboarding_started',
  'onboarding_completed',
  'taste_profile_saved',
  'assessment_started',
  'assessment_completed',
  'session_started',
  'session_completed',
  'session_abandoned',
  'item_served',
  'item_answered',
  'correction_shown',
  'feedback_given',
  'conversation_turn',
  'phrase_saved',
  'recommendation_shown',
  'recommendation_accepted',
  'recommendation_rejected',
  'media_started',
  'media_finished',
  'media_reflection_completed',
  'notification_sent',
  'notification_opened',
  'consent_granted',
  'consent_revoked',
  'auth_started',
  'auth_upgraded',
  'device_registered',
  'device_revoked',
  'rls_denied',
  'level_changed',
  'test_out',
  'challenge_started',
  'remediation_started',
  'remediation_completed',
  'content_requested',
  'content_generated',
  'content_failed',
  'content_capped',
  'content_promoted',
  'export_completed',
  'import_completed',
  'error_shown',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

const ALLOWED_PROPERTIES = new Set([
  'platform',
  'app_version',
  'source',
  'goal',
  'daily_minutes',
  'streak_mode',
  'formats',
  'genres_count',
  'kind',
  'level_band',
  'confidence',
  'duration_sec',
  'planned_minutes',
  'blocks',
  'items',
  'production_sec',
  'progress_pct',
  'item_type',
  'skill',
  'coverage',
  'correct',
  'latency_ms',
  'hint_used',
  'rule_id',
  'severity',
  'confidence_bucket',
  'target_type',
  'rating',
  'reason_code',
  'turn_index',
  'stt_used',
  'has_note',
  'score_bucket',
  'format',
  'media_id_hash',
  'rank',
  'weeks',
  'method',
  'table',
  'operation',
  'from',
  'to',
  'reason',
  'concept',
  'passed',
  'purpose',
  'count',
  'cache_hit',
  'cost_bucket',
  'format_version',
  'rows',
  'surface',
  'code',
  'window',
  'version',
  'channel',
]);

const FORBIDDEN_KEY = /email|mail|nickname|name|comment|text|transcript|title|prompt|ip|token|secret|phone|address/i;

const MAX_PROPERTIES = 24;
const MAX_STRING = 120;

export const productEventSchema = z.object({
  name: z.enum(PRODUCT_EVENT_NAMES),
  schemaVersion: z.literal(1),
  occurredAt: z.iso.datetime({ offset: false }),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type ProductEvent = z.infer<typeof productEventSchema>;

export type ProductEventError = 'invalid_event' | 'unknown_event';

export const productEventInputSchema = z.object({
  name: z.string().min(1),
  schemaVersion: z.number().int().positive().optional(),
  occurredAt: z.string().min(1),
  properties: z.unknown().optional(),
});

function sanitizeValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  return undefined;
}

export function sanitizeProductEvent(
  raw: unknown,
): Result<ProductEvent, ProductEventError> {
  const parsed = productEventInputSchema.safeParse(raw);
  if (!parsed.success) return err('invalid_event');
  const { name } = parsed.data;
  if (!(PRODUCT_EVENT_NAMES as readonly string[]).includes(name)) {
    return err('unknown_event');
  }
  if (!isUtcIso(parsed.data.occurredAt)) return err('invalid_event');
  if (parsed.data.schemaVersion !== undefined && parsed.data.schemaVersion !== 1) {
    return err('invalid_event');
  }

  const properties: Record<string, string | number | boolean | null> = {};
  if (typeof parsed.data.properties === 'object' && parsed.data.properties !== null) {
    let count = 0;
    for (const [key, value] of Object.entries(parsed.data.properties)) {
      if (count >= MAX_PROPERTIES) break;
      if (FORBIDDEN_KEY.test(key)) continue;
      if (!ALLOWED_PROPERTIES.has(key)) continue;
      const sanitized = sanitizeValue(value);
      if (sanitized === undefined) continue;
      properties[key] = sanitized;
      count += 1;
    }
  }

  return ok({
    name: name as ProductEventName,
    schemaVersion: 1,
    occurredAt: parsed.data.occurredAt,
    properties,
  });
}
