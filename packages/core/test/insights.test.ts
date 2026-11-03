import { describe, expect, it } from 'vitest';

import { buildWeekInsights } from '../src/insights.js';

describe('week insights', () => {
  it('aggregates seven days and a 28-day heatmap', () => {
    const insights = buildWeekInsights({
      now: new Date('2026-11-02T12:00:00.000Z'),
      timeZone: 'UTC',
      attempts: [
        { correct: true, createdAt: '2026-11-02T09:00:00.000Z' },
        { correct: false, createdAt: '2026-11-01T09:00:00.000Z' },
      ],
      xpEvents: [{ amount: 20, createdAt: '2026-11-02T09:00:00.000Z' }],
      errors: [
        {
          createdAt: '2026-10-31T09:00:00.000Z',
          ruleId: 'en.gram.tense.present_perfect',
          errorType: 'tense',
        },
        {
          createdAt: '2026-10-30T09:00:00.000Z',
          ruleId: 'en.gram.tense.present_perfect',
          errorType: 'tense',
        },
      ],
    });
    expect(insights.days).toHaveLength(7);
    expect(insights.heatmap).toHaveLength(28);
    expect(insights.attempts).toBe(2);
    expect(insights.correctRate).toBe(0.5);
    expect(insights.xp).toBe(20);
    expect(insights.errors).toBe(2);
    expect(insights.activeDays).toBe(2);
    expect(insights.errorHeatmap[0]?.count).toBe(2);
    expect(insights.errorHeatmap[0]?.ruleId).toBe('en.gram.tense.present_perfect');
  });
});
