import { describe, expect, it } from 'vitest';

import { sanitizeProductEvent } from '../src/events.js';

describe('product event taxonomy', () => {
  it('accepts a known event and keeps allowed properties', () => {
    const result = sanitizeProductEvent({
      name: 'app_open',
      occurredAt: '2026-11-02T10:00:00.000Z',
      properties: {
        platform: 'web',
        app_version: '0.1.0',
        email: 'learner@example.test',
        transcript: 'private text',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('app_open');
    expect(result.value.properties).toEqual({ platform: 'web', app_version: '0.1.0' });
  });

  it('rejects unknown event names', () => {
    const result = sanitizeProductEvent({
      name: 'raw_user_text',
      occurredAt: '2026-11-02T10:00:00.000Z',
    });
    expect(result).toEqual({ ok: false, error: 'unknown_event' });
  });

  it('rejects non-UTC timestamps', () => {
    const result = sanitizeProductEvent({
      name: 'session_started',
      occurredAt: '2026-11-02T10:00:00+01:00',
    });
    expect(result.ok).toBe(false);
  });

  it('drops unknown keys and nested values', () => {
    const result = sanitizeProductEvent({
      name: 'item_answered',
      occurredAt: '2026-11-02T10:00:00.000Z',
      properties: {
        correct: true,
        latency_ms: 1200,
        unknown_field: 'x',
        nested: { secret: 'value' },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.properties).toEqual({ correct: true, latency_ms: 1200 });
  });

  it('truncates long strings', () => {
    const result = sanitizeProductEvent({
      name: 'error_shown',
      occurredAt: '2026-11-02T10:00:00.000Z',
      properties: { surface: 'x'.repeat(500) },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value.properties.surface as string).length).toBe(120);
  });
});
