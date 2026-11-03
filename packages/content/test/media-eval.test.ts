import { describe, expect, it } from 'vitest';

import {
  coverageForLevel,
  defaultTasteProfile,
  rankMedia,
  type CefrLevel,
  type MediaCandidate,
  type MediaGenre,
  type MediaTheme,
  type RankMediaRequest,
  type TasteProfile,
} from '@loqua/core';

import { MEDIA_CATALOG, type MediaCatalogEntry } from '../src/media-catalog.js';

const REGIONS = ['IT', 'US', 'GB', 'FR', 'DE'] as const;

interface EvalProfile {
  readonly id: string;
  readonly level: CefrLevel;
  readonly formats: TasteProfile['formats'];
  readonly genres: MediaGenre[];
  readonly themes: MediaTheme[];
  readonly tolerance: TasteProfile['difficultyTolerance'];
  readonly weeklyMinutes: number;
}

const PROFILES: readonly EvalProfile[] = [
  {
    id: 'p01',
    level: 'A1',
    formats: ['movie'],
    genres: ['comedy', 'drama'],
    themes: ['daily_life', 'humor'],
    tolerance: 'easy',
    weeklyMinutes: 120,
  },
  {
    id: 'p02',
    level: 'A2',
    formats: ['series'],
    genres: ['comedy', 'romance'],
    themes: ['relationships', 'humor'],
    tolerance: 'balanced',
    weeklyMinutes: 180,
  },
  {
    id: 'p03',
    level: 'B1',
    formats: ['movie', 'series'],
    genres: ['thriller', 'crime'],
    themes: ['mystery', 'society'],
    tolerance: 'balanced',
    weeklyMinutes: 240,
  },
  {
    id: 'p04',
    level: 'B1',
    formats: ['book'],
    genres: ['biography', 'history'],
    themes: ['society', 'work'],
    tolerance: 'easy',
    weeklyMinutes: 300,
  },
  {
    id: 'p05',
    level: 'B2',
    formats: ['movie', 'book'],
    genres: ['sci_fi', 'documentary'],
    themes: ['science', 'society'],
    tolerance: 'challenging',
    weeklyMinutes: 240,
  },
  {
    id: 'p06',
    level: 'B2',
    formats: ['series', 'book'],
    genres: ['drama', 'romance'],
    themes: ['relationships', 'daily_life'],
    tolerance: 'balanced',
    weeklyMinutes: 180,
  },
  {
    id: 'p07',
    level: 'C1',
    formats: ['movie', 'series', 'book'],
    genres: ['history', 'drama'],
    themes: ['society', 'work'],
    tolerance: 'challenging',
    weeklyMinutes: 300,
  },
  {
    id: 'p08',
    level: 'A2',
    formats: ['movie', 'series'],
    genres: ['fantasy', 'comedy'],
    themes: ['humor', 'travel'],
    tolerance: 'easy',
    weeklyMinutes: 120,
  },
  {
    id: 'p09',
    level: 'B1',
    formats: ['book'],
    genres: ['business', 'tech'],
    themes: ['work', 'science'],
    tolerance: 'balanced',
    weeklyMinutes: 240,
  },
  {
    id: 'p10',
    level: 'C1',
    formats: ['movie', 'series'],
    genres: ['documentary', 'biography'],
    themes: ['society', 'science'],
    tolerance: 'balanced',
    weeklyMinutes: 180,
  },
];

function candidateFor(entry: MediaCatalogEntry, region: string): MediaCandidate {
  const rows = entry.availability.filter((row) => row.region === region);
  return {
    ...entry,
    availabilityRegions: rows.length > 0 ? [region] : [],
    availabilityProviders: [...new Set(rows.map((row) => row.provider))],
  };
}

function tasteFor(profile: EvalProfile, region: string): TasteProfile {
  return {
    ...defaultTasteProfile(region),
    formats: [...profile.formats],
    genres: [...profile.genres],
    themes: [...profile.themes],
    difficultyTolerance: profile.tolerance,
    weeklyMinutes: profile.weeklyMinutes,
    region,
  };
}

function requestFor(profile: EvalProfile, region: string): RankMediaRequest {
  const tastes = tasteFor(profile, region);
  return {
    targetLang: 'en',
    level: profile.level,
    tastes,
    weakConcepts: ['en.prag.requests', 'en.gram.tense.present_perfect'],
    recentErrorTypes: ['tense', 'agreement'],
    region,
    weeklyMinutes: profile.weeklyMinutes,
    history: { excludedIds: [], lastRecommendedIds: [], recentTags: [] },
    limit: 5,
    seed: 42,
  };
}

describe('media recommendation eval set', () => {
  it('has a catalog that can serve every region and level', () => {
    expect(MEDIA_CATALOG).toHaveLength(50);
    for (const region of REGIONS) {
      const eligible = MEDIA_CATALOG.filter((entry) =>
        entry.availability.some((row) => row.region === region),
      );
      expect(eligible.length).toBeGreaterThanOrEqual(10);
    }
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      expect(MEDIA_CATALOG.filter((entry) => entry.difficultyBand === level).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('ranks 10 profiles across 5 regions with legal, level-fit, diverse picks', () => {
    let picks = 0;
    let inLevelBand = 0;

    for (const profile of PROFILES) {
      for (const region of REGIONS) {
        const candidates = MEDIA_CATALOG.map((entry) => candidateFor(entry, region));
        const request = requestFor(profile, region);
        const ranked = rankMedia(candidates, request);
        expect(ranked.length).toBeGreaterThan(0);

        for (const item of ranked) {
          expect(item.media.availabilityRegions).toContain(region);
          const coverage = coverageForLevel(item.media, profile.level);
          picks += 1;
          if (coverage >= 0.88 && coverage <= 0.97) inLevelBand += 1;
        }

        if (ranked.length >= 5) {
          const genres = new Set(ranked.flatMap((item) => item.media.genres));
          expect(genres.size).toBeGreaterThanOrEqual(4);
        }

        const again = rankMedia(candidates, request);
        expect(again.map((item) => item.mediaId)).toEqual(ranked.map((item) => item.mediaId));
      }
    }

    expect(picks).toBeGreaterThanOrEqual(PROFILES.length * REGIONS.length * 3);
    expect(inLevelBand / picks).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps metadata legal and spoiler-free', () => {
    const forbidden = /piracy|torrent|unofficial|download|transcript|subtitle dump/i;
    for (const entry of MEDIA_CATALOG) {
      expect(entry.reviewStatus).toBe('approved');
      expect(entry.synopsis.toLowerCase()).not.toMatch(/ending|twist|dies|finale|reveal/);
      for (const row of entry.availability) {
        expect(row.provider).not.toMatch(forbidden);
      }
      expect(entry.licenseNote).not.toMatch(forbidden);
    }
  });
});
