import { describe, expect, it } from 'vitest';

import {
  decayTaste,
  defaultTasteProfile,
  deterministicExplanation,
  fallbackGuide,
  fallbackReflection,
  gapFitFor,
  isEligible,
  MEDIA_GENRES,
  mediaCandidateSchema,
  rankMedia,
  tasteProfileSchema,
  updateTaste,
  type MediaCandidate,
  type RankMediaRequest,
  type ScoredRecommendation,
  type TasteProfile,
} from '../src/media.js';

const baseCandidate = {
  id: 'media-base',
  kind: 'movie' as const,
  targetLang: 'en',
  title: 'Base Title',
  difficultyBand: 'B1' as const,
  difficultyScore: 0.5,
  coverage: { A1: 0.99, A2: 0.97, B1: 0.93, B2: 0.86, C1: 0.78 },
  editorialQuality: 4,
  genres: ['drama'],
  themes: ['daily_life'],
  conceptTags: ['en.gram.tense.present_perfect'],
  contentWarnings: [],
  availabilityRegions: ['IT'],
  availabilityProviders: ['provider-a'],
  durationMinutes: 100,
  freshnessDays: 20,
};

function media(overrides: Partial<MediaCandidate> & { id: string }): MediaCandidate {
  return mediaCandidateSchema.parse({ ...baseCandidate, ...overrides });
}

function taste(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return tasteProfileSchema.parse({ ...defaultTasteProfile('IT'), ...overrides });
}

function request(overrides: Partial<RankMediaRequest> = {}): RankMediaRequest {
  return {
    targetLang: 'en',
    level: 'B1',
    tastes: taste(),
    weakConcepts: [],
    recentErrorTypes: [],
    region: 'IT',
    weeklyMinutes: 300,
    history: { excludedIds: [], lastRecommendedIds: [], recentTags: [] },
    limit: 5,
    ...overrides,
  };
}

function ids(result: readonly ScoredRecommendation[]): string[] {
  return result.map((item) => item.mediaId);
}

describe('rankMedia', () => {
  it('is deterministic and breaks ties by title then id', () => {
    const catalog = [
      media({ id: 'z-alpha', title: 'Alpha' }),
      media({ id: 'a-bravo', title: 'Bravo' }),
    ];
    const first = rankMedia(catalog, request({ limit: 5 }));
    const second = rankMedia(catalog, request({ limit: 5 }));

    expect(ids(first)).toEqual(['z-alpha', 'a-bravo']);
    expect(second).toEqual(first);
  });

  it('keeps at least 90% of top picks within the target coverage band', () => {
    const catalog = Array.from({ length: 13 }, (_, index) => {
      const coverage = index === 12 ? 0.7 : 0.9 + (index % 7) * 0.01;
      return media({
        id: `level-${index}`,
        title: `Level ${String(index).padStart(2, '0')}`,
        kind: 'movie',
        genres: [MEDIA_GENRES[index % MEDIA_GENRES.length] ?? 'drama'],
        themes: ['daily_life'],
        coverage: { A1: 0.99, A2: 0.97, B1: coverage, B2: 0.86, C1: 0.78 },
      });
    });

    const result = rankMedia(catalog, request({ limit: 10 }));
    const inBand = result.filter((item) => {
      const coverage = item.media.coverage.B1 ?? 0;
      return coverage >= 0.88 && coverage <= 0.97;
    });

    expect(result).toHaveLength(10);
    expect(inBand.length / result.length).toBeGreaterThanOrEqual(0.9);
  });

  it('applies hard filters for region, format, dislikes, age, excluded ids and duration', () => {
    const catalog = [
      media({
        id: 'good',
        title: 'Good',
        genres: ['biography'],
        durationMinutes: 90,
        ageRating: 'PG',
      }),
      media({
        id: 'bad-region',
        title: 'Bad Region',
        availabilityRegions: ['US'],
      }),
      media({ id: 'bad-dislike', title: 'Bad Dislike', genres: ['thriller'] }),
      media({ id: 'bad-age', title: 'Bad Age', ageRating: '18' }),
      media({ id: 'excluded', title: 'Excluded' }),
      media({ id: 'long-movie', title: 'Long Movie', durationMinutes: 1000 }),
      media({
        id: 'long-series',
        title: 'Long Series',
        kind: 'series',
        episodeMinutes: 200,
      }),
      media({ id: 'long-book', title: 'Long Book', kind: 'book', pageCount: 500 }),
    ];

    const filtered = rankMedia(
      catalog,
      request({
        weeklyMinutes: 100,
        tastes: taste({ disliked: ['thriller'], maxAgeRating: '12' }),
        history: { excludedIds: ['excluded'], lastRecommendedIds: [], recentTags: [] },
        limit: 20,
      }),
    );

    expect(ids(filtered)).toEqual(['good']);

    const formatFiltered = rankMedia(
      catalog,
      request({ tastes: taste({ formats: ['movie'] }), limit: 20 }),
    );
    expect(ids(formatFiltered)).not.toContain('long-series');
    expect(ids(formatFiltered)).not.toContain('long-book');
    expect(ids(formatFiltered)).toContain('good');
  });

  it('enforces genre and franchise diversity caps in the top 5', () => {
    const catalog = [
      media({ id: 'd1', title: 'Drama 1', genres: ['drama'] }),
      media({ id: 'd2', title: 'Drama 2', genres: ['drama'] }),
      media({ id: 'd3', title: 'Drama 3', genres: ['drama'] }),
      media({ id: 'c1', title: 'Comedy 1', genres: ['comedy'] }),
      media({ id: 'c2', title: 'Comedy 2', genres: ['comedy'] }),
      media({ id: 't1', title: 'Thriller 1', genres: ['thriller'] }),
      media({ id: 't2', title: 'Thriller 2', genres: ['thriller'] }),
    ];

    const result = rankMedia(
      catalog,
      request({
        limit: 5,
        tastes: taste({ genres: ['drama', 'comedy', 'thriller'] }),
      }),
    );

    expect(result).toHaveLength(5);
    const counts = new Map<string, number>();
    for (const item of result) {
      for (const genre of item.media.genres) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);

    const franchiseCatalog = [
      media({ id: 'f1', title: 'Franchise 1', genres: ['drama'], franchise: 'Saga' }),
      media({ id: 'f2', title: 'Franchise 2', genres: ['comedy'], franchise: 'Saga' }),
      media({ id: 'x1', title: 'Other 1', genres: ['thriller'] }),
      media({ id: 'x2', title: 'Other 2', genres: ['sci_fi'] }),
      media({ id: 'x3', title: 'Other 3', genres: ['romance'] }),
      media({ id: 'x4', title: 'Other 4', genres: ['history'] }),
    ];
    const franchiseResult = rankMedia(
      franchiseCatalog,
      request({ limit: 5, tastes: taste({ genres: [] }) }),
    );
    expect(franchiseResult.filter((item) => item.media.franchise === 'Saga')).toHaveLength(1);
  });

  it('uses seed-based exploration deterministically and only for multiples of ten', () => {
    const catalog = [
      { title: 'A Drama', genre: 'drama' },
      { title: 'B Comedy', genre: 'comedy' },
      { title: 'C Thriller', genre: 'thriller' },
      { title: 'D Sci Fi', genre: 'sci_fi' },
      { title: 'E Romance', genre: 'romance' },
      { title: 'Z History', genre: 'history' },
    ].map(({ title, genre }, index) =>
      media({
        id: `seed-${index}`,
        title,
        genres: [genre],
      }),
    );

    const explored = rankMedia(catalog, request({ limit: 5, seed: 20 }));
    const exploredAgain = rankMedia(catalog, request({ limit: 5, seed: 20 }));
    const notExplored = rankMedia(catalog, request({ limit: 5, seed: 1 }));

    expect(exploredAgain).toEqual(explored);
    expect(ids(explored)).not.toEqual(ids(notExplored));
    expect(ids(explored)).toContain('seed-5');
    expect(ids(notExplored)).not.toContain('seed-5');
  });
});

describe('feedback and taste updates', () => {
  it('rejection and too_hard feedback lower the score and change the taste profile', () => {
    const candidate = media({
      id: 'drama-hit',
      title: 'Drama Hit',
      genres: ['drama'],
      themes: ['relationships'],
      coverage: { A1: 0.99, A2: 0.97, B1: 0.93, B2: 0.86, C1: 0.78 },
      editorialQuality: 5,
    });
    const other = media({
      id: 'comedy-ok',
      title: 'Comedy Ok',
      genres: ['comedy'],
      themes: ['humor'],
      coverage: { A1: 0.99, A2: 0.97, B1: 0.9, B2: 0.83, C1: 0.75 },
      editorialQuality: 3,
    });
    const initialTaste = taste({ genres: ['drama'], themes: ['relationships'] });
    const before = rankMedia([candidate, other], request({ tastes: initialTaste, limit: 2 }));
    expect(ids(before)[0]).toBe('drama-hit');

    const updated = updateTaste(
      initialTaste,
      { kind: 'rejected', difficulty: 'too_hard' },
      candidate,
    );
    expect(updated.genreWeights.drama).toBeCloseTo(0.85);
    expect(updated.themeWeights.relationships).toBeCloseTo(0.85);
    expect(updated.difficultyTolerance).toBe('easy');
    expect(updated.coverageOffset).toBeCloseTo(-0.02);

    const after = rankMedia([candidate, other], request({ tastes: updated, limit: 2 }));
    const beforeScore = before.find((item) => item.mediaId === 'drama-hit')?.score ?? 0;
    const afterScore = after.find((item) => item.mediaId === 'drama-hit')?.score ?? 0;
    expect(afterScore).toBeLessThan(beforeScore);
  });

  it('clamps weights and coverage offset and normalizes decayed weights', () => {
    const profile = taste({
      genres: ['drama'],
      themes: ['work'],
      difficultyTolerance: 'balanced',
      genreWeights: { drama: 0.98 },
      themeWeights: { work: 0.5 },
      coverageOffset: 0.015,
    });
    const candidate = media({ id: 'weighted', genres: ['drama'], themes: ['work'] });

    const accepted = updateTaste(profile, { kind: 'accepted', rating: 5 }, candidate);
    expect(accepted.genreWeights.drama).toBe(1);
    expect(accepted.themeWeights.work).toBeCloseTo(0.66);
    expect(accepted.coverageOffset).toBeCloseTo(0.015);

    const tooEasy = updateTaste(accepted, { kind: 'started', difficulty: 'too_easy' }, candidate);
    expect(tooEasy.difficultyTolerance).toBe('challenging');
    expect(tooEasy.coverageOffset).toBeCloseTo(0.02);

    const tooHard = updateTaste(tooEasy, { kind: 'started', difficulty: 'too_hard' }, candidate);
    expect(tooHard.difficultyTolerance).toBe('balanced');
    expect(tooHard.coverageOffset).toBeCloseTo(0);

    const low = taste({ genres: ['comedy'], genreWeights: { comedy: 0.05 } });
    const rejected = updateTaste(
      low,
      { kind: 'rejected' },
      media({ id: 'rejected', genres: ['comedy'] }),
    );
    expect(rejected.genreWeights.comedy).toBe(0);

    const decayed = decayTaste(
      taste({ genreWeights: { drama: 0.8, comedy: 0.4 }, themeWeights: { humor: 0.2 } }),
    );
    const allWeights = [
      ...Object.values(decayed.genreWeights),
      ...Object.values(decayed.themeWeights),
    ];
    expect(Math.max(...allWeights)).toBeCloseTo(1);
    expect(decayed.genreWeights.comedy).toBeCloseTo(0.5);
    expect(decayed.themeWeights.humor).toBeCloseTo(0.25);
    expect(() => tasteProfileSchema.parse(decayed)).not.toThrow();
  });
});

describe('fallback copy and reflection', () => {
  it('keeps explanations and guides metadata-only and spoiler-free', () => {
    const candidate = media({
      id: 'spoiler-check',
      title: 'Plot Secret Title',
      genres: ['drama'],
      themes: ['daily_life'],
    });
    const explanation = deterministicExplanation(candidate, request());
    const guide = fallbackGuide(candidate, ['en.gram.tense', 'en.vocab.work', 'extra', 'ignored']);

    const explanationText = JSON.stringify(explanation);
    const guideText = JSON.stringify(guide);

    expect(explanationText).not.toContain('Plot Secret Title');
    expect(guideText).not.toContain('Plot Secret Title');
    expect(explanation.whyItFits).toContain('drama');
    expect(explanation.levelNote).toContain('B1');
    expect(explanation.phrasesToNotice).toHaveLength(5);
    expect(guide.targetConcepts).toHaveLength(3);
    expect(guide.functionalPhrases.length).toBeGreaterThanOrEqual(5);
    expect(guide.functionalPhrases.length).toBeLessThanOrEqual(8);
    expect(guide.comprehensionPrompts.length).toBeGreaterThanOrEqual(3);
    expect(guide.comprehensionPrompts.length).toBeLessThanOrEqual(5);
    expect(guide.before.length).toBeGreaterThan(0);
    expect(guide.during.length).toBeGreaterThan(0);
    expect(guide.after.length).toBeGreaterThan(0);
  });

  it('counts production at 80 characters or 60 seconds', () => {
    expect(fallbackReflection('Too short.').countsAsProduction).toBe(false);
    expect(fallbackReflection('a'.repeat(80)).countsAsProduction).toBe(true);
    expect(fallbackReflection('', 60).countsAsProduction).toBe(true);
    expect(fallbackReflection('', 59).countsAsProduction).toBe(false);

    const result = fallbackReflection('a'.repeat(80));
    expect(result.praise.length).toBeGreaterThan(0);
    expect(result.nextFocus.length).toBeGreaterThan(0);
  });
});

describe('helpers and defaults', () => {
  it('derives a safe coverage value when no CEFR coverage is available', () => {
    const candidate = media({
      id: 'no-coverage',
      coverage: {},
      difficultyScore: 0.9,
    });
    const coverage = rankMedia([candidate], request({ limit: 1 }))[0]?.components.levelFit;
    expect(coverage).toBeGreaterThanOrEqual(0);
    expect(coverage).toBeLessThanOrEqual(1);
  });

  it('matches weak concepts exactly and error types by concept segment', () => {
    const candidate = media({
      id: 'gap',
      conceptTags: ['en.gram.tense.present_perfect', 'en.vocab.travel.airport'],
    });
    expect(gapFitFor(candidate, ['en.gram.tense.present_perfect'], [])).toBe(1);
    expect(gapFitFor(candidate, [], ['tense'])).toBe(1);
    expect(gapFitFor(candidate, ['missing.concept'], [])).toBe(0);
    expect(gapFitFor(candidate, [], [])).toBe(0);
  });

  it('provides balanced default taste and rejects unknown-region defaults safely', () => {
    const defaults = defaultTasteProfile();
    expect(defaults.difficultyTolerance).toBe('balanced');
    expect(defaults.subtitlePref).toBe('target');
    expect(defaults.region).toBe('IT');
    expect(defaults.coverageOffset).toBe(0);
    expect(defaultTasteProfile('us').region).toBe('US');
    expect(defaultTasteProfile('bad!').region).toBe('IT');
  });

  it('exposes eligibility for direct checks', () => {
    const candidate = media({ id: 'direct', ageRating: 'G' });
    expect(isEligible(candidate, request())).toBe(true);
    expect(isEligible(candidate, request({ region: 'US' }))).toBe(false);
  });
});
