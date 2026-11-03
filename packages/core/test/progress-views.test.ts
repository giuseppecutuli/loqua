import { describe, expect, it } from 'vitest';

import {
  buildCefrTrend,
  buildErrorHeatmap,
  buildSkillRadar,
} from '../src/progress-views.js';

describe('progress views', () => {
  it('builds a radar from real mastery data', () => {
    const radar = buildSkillRadar([
      { skill: 'grammar', level: 'B1', mastery: 0.62, confidence: 0.8 },
      { skill: 'speaking', level: 'A2', mastery: 0.31, confidence: 0.45 },
    ]);
    expect(radar).toHaveLength(2);
    expect(radar[0]).toEqual({
      skill: 'grammar',
      level: 'B1',
      value: 0.62,
      mastery: 0.62,
      confidence: 0.8,
    });
  });

  it('clamps out-of-range mastery values', () => {
    const radar = buildSkillRadar([
      { skill: 'grammar', level: 'B1', mastery: 1.4, confidence: -0.2 },
    ]);
    expect(radar[0]?.value).toBe(1);
    expect(radar[0]?.confidence).toBe(0);
  });

  it('builds a monthly CEFR trend with a confidence band', () => {
    const trend = buildCefrTrend([
      { overallLevel: 'A2', confidence: 0.6, completedAt: '2026-09-10T10:00:00.000Z' },
      { overallLevel: 'B1', confidence: 0.7, completedAt: '2026-10-12T10:00:00.000Z' },
      { overallLevel: 'B1', confidence: 0.9, completedAt: '2026-10-28T10:00:00.000Z' },
    ]);
    expect(trend).toHaveLength(2);
    expect(trend[0]?.month).toBe('2026-09');
    expect(trend[1]?.level).toBe('B1');
    expect(trend[1]?.value).toBe(3);
    expect(trend[1]?.lower).toBeLessThanOrEqual(trend[1]?.value ?? 0);
    expect(trend[1]?.upper).toBeGreaterThanOrEqual(trend[1]?.value ?? 0);
    expect(trend[1]?.confidence).toBe(0.9);
  });

  it('groups recurring errors by rule and keeps the most frequent first', () => {
    const heatmap = buildErrorHeatmap([
      { ruleId: 'en.gram.tense.present_perfect', errorType: 'tense', createdAt: '2026-11-01T10:00:00.000Z' },
      { ruleId: 'en.gram.tense.present_perfect', errorType: 'tense', createdAt: '2026-11-02T10:00:00.000Z' },
      { ruleId: null, errorType: 'spelling', createdAt: '2026-11-01T12:00:00.000Z' },
    ]);
    expect(heatmap).toHaveLength(2);
    expect(heatmap[0]?.ruleId).toBe('en.gram.tense.present_perfect');
    expect(heatmap[0]?.count).toBe(2);
    expect(heatmap[0]?.lastSeenAt).toBe('2026-11-02T10:00:00.000Z');
    expect(heatmap[1]?.key).toBe('type:spelling');
  });
});
