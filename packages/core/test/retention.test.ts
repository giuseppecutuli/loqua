import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RETENTION_POLICY,
  isAudioExpired,
  isMediaRecommendationExpired,
  isTranscriptExpired,
  retentionCutoffs,
} from '../src/retention.js';

const now = new Date('2026-11-07T12:00:00.000Z');

describe('retention policy', () => {
  it('computes audio, transcript and media cutoffs from now', () => {
    expect(retentionCutoffs(now)).toEqual({
      audioBefore: '2026-11-05T12:00:00.000Z',
      transcriptBefore: '2026-08-09T12:00:00.000Z',
      mediaRecommendationBefore: '2026-10-24T12:00:00.000Z',
    });
  });

  it('expires audio after 48 hours but not before', () => {
    expect(isAudioExpired('2026-11-05T11:59:59.000Z', now)).toBe(true);
    expect(isAudioExpired('2026-11-05T12:00:00.000Z', now)).toBe(false);
    expect(isAudioExpired('2026-11-07T11:00:00.000Z', now)).toBe(false);
  });

  it('expires transcripts after 90 days', () => {
    expect(isTranscriptExpired('2026-08-09T11:59:59.000Z', now)).toBe(true);
    expect(isTranscriptExpired('2026-08-09T12:00:00.000Z', now)).toBe(false);
  });

  it('expires media recommendations after 14 days', () => {
    expect(isMediaRecommendationExpired('2026-10-24T11:59:59.000Z', now)).toBe(true);
    expect(isMediaRecommendationExpired('2026-10-24T12:00:00.000Z', now)).toBe(false);
  });

  it('honours a custom policy', () => {
    const cutoffs = retentionCutoffs(now, {
      ...DEFAULT_RETENTION_POLICY,
      audioHours: 24,
    });
    expect(cutoffs.audioBefore).toBe('2026-11-06T12:00:00.000Z');
  });
});
