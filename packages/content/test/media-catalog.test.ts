import { describe, expect, it } from 'vitest';

import {
  CEFR_LEVELS,
  MEDIA_GENRES,
  MEDIA_KINDS,
  MEDIA_THEMES,
} from '@loqua/core';

import { CONCEPTS } from '../src/knowledge-graph.js';
import {
  getMediaTitle,
  listMediaTitles,
  MEDIA_AVAILABILITY_REGIONS,
  MEDIA_CATALOG,
  MEDIA_TITLES,
} from '../src/media-catalog.js';

const REQUIRED_AVAILABILITY_REGIONS = ['IT', 'US', 'GB', 'FR', 'DE'] as const;

const ALLOWED_PROVIDERS = new Set([
  'Netflix',
  'Prime Video',
  'Disney+',
  'Apple TV+',
  'Max',
  'Paramount+',
  'MUBI',
  'Kanopy',
  'Kindle Store',
  'Kobo',
  'Apple Books',
  'Google Play Books',
  'Libby',
  'Audible',
  'YouTube Movies',
]);

const SPOILER_WORDS = ['ending', 'twist', 'dies', 'finale', 'reveal'] as const;
const FORBIDDEN_AVAILABILITY_TERMS = /piracy|unofficial|torrent|download/i;

describe('media catalog v0', () => {
  it('contains exactly 50 approved English titles with unique ids', () => {
    expect(MEDIA_CATALOG).toHaveLength(50);
    expect(new Set(MEDIA_CATALOG.map((entry) => entry.id)).size).toBe(MEDIA_CATALOG.length);
    expect(new Set(MEDIA_CATALOG.map((entry) => entry.title)).size).toBe(MEDIA_CATALOG.length);

    for (const entry of MEDIA_CATALOG) {
      expect(entry.reviewStatus).toBe('approved');
      expect(entry.targetLang).toBe('en');
      expect(entry.releaseYear).toBeGreaterThan(1800);
    }
  });

  it('has at least 10 titles per kind and 8 per CEFR level', () => {
    for (const kind of MEDIA_KINDS) {
      const count = MEDIA_CATALOG.filter((entry) => entry.kind === kind).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }

    for (const level of CEFR_LEVELS) {
      const count = MEDIA_CATALOG.filter((entry) => entry.difficultyBand === level).length;
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });

  it('provides complete monotonic coverage and own-band coverage within range', () => {
    for (const entry of MEDIA_CATALOG) {
      const coverages = CEFR_LEVELS.map((level) => entry.coverage[level]);

      for (const coverage of coverages) {
        expect(coverage).toBeDefined();
      }

      for (let index = 1; index < coverages.length; index += 1) {
        const previous = coverages[index - 1];
        const current = coverages[index];
        expect(previous).not.toBeUndefined();
        expect(current).not.toBeUndefined();
        expect(current ?? 0).toBeGreaterThanOrEqual(previous ?? 0);
      }

      const ownBand = entry.coverage[entry.difficultyBand];
      expect(ownBand).not.toBeUndefined();
      expect(ownBand ?? 0).toBeGreaterThanOrEqual(0.88);
      expect(ownBand ?? 0).toBeLessThanOrEqual(0.97);
    }
  });

  it('lists valid legal availability in every required region', () => {
    for (const entry of MEDIA_CATALOG) {
      for (const region of REQUIRED_AVAILABILITY_REGIONS) {
        const rows = entry.availability.filter((row) => row.region === region);
        expect(rows.length).toBeGreaterThan(0);
      }

      const availabilityText = JSON.stringify(entry.availability).toLowerCase();
      expect(availabilityText).not.toMatch(FORBIDDEN_AVAILABILITY_TERMS);
      expect(entry.licenseNote.toLowerCase()).not.toMatch(FORBIDDEN_AVAILABILITY_TERMS);

      for (const row of entry.availability) {
        expect(ALLOWED_PROVIDERS.has(row.provider)).toBe(true);
        expect(MEDIA_AVAILABILITY_REGIONS).toContain(row.region);
      }

      const regions = [...new Set(entry.availability.map((row) => row.region.toUpperCase()))];
      const providers = [...new Set(entry.availability.map((row) => row.provider))];
      expect(entry.availabilityRegions).toEqual(regions);
      expect(entry.availabilityProviders).toEqual(providers);
    }
  });

  it('uses valid concept tags, genres, and themes', () => {
    const conceptIds = new Set(CONCEPTS.map((concept) => concept.id));
    const genres = new Set<string>(MEDIA_GENRES);
    const themes = new Set<string>(MEDIA_THEMES);

    for (const entry of MEDIA_CATALOG) {
      expect(entry.conceptTags.length).toBeGreaterThanOrEqual(2);
      expect(entry.conceptTags.length).toBeLessThanOrEqual(3);
      for (const tag of entry.conceptTags) {
        expect(conceptIds.has(tag)).toBe(true);
      }
      for (const genre of entry.genres) {
        expect(genres.has(genre)).toBe(true);
      }
      for (const theme of entry.themes) {
        expect(themes.has(theme)).toBe(true);
      }
    }
  });

  it('keeps synopses short and spoiler-free', () => {
    for (const entry of MEDIA_CATALOG) {
      expect(entry.synopsis.trim().length).toBeGreaterThan(0);
      expect(entry.synopsis.length).toBeLessThanOrEqual(300);

      const lower = entry.synopsis.toLowerCase();
      for (const word of SPOILER_WORDS) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it('includes format-specific runtime metadata', () => {
    for (const entry of MEDIA_CATALOG) {
      expect(entry.ageRating).toBeTruthy();
      expect(entry.availability.length).toBeGreaterThan(0);

      if (entry.kind === 'movie') {
        expect(entry.durationMinutes).toBeGreaterThan(0);
      } else if (entry.kind === 'series') {
        expect(entry.episodeCount).toBeGreaterThan(0);
        expect(entry.episodeMinutes).toBeGreaterThan(0);
      } else {
        expect(entry.pageCount).toBeGreaterThan(0);
      }
    }
  });

  it('filters titles by target language', () => {
    expect(MEDIA_TITLES).toBe(MEDIA_CATALOG);
    expect(listMediaTitles()).toHaveLength(MEDIA_CATALOG.length);
    expect(listMediaTitles('en')).toHaveLength(MEDIA_CATALOG.length);
    expect(listMediaTitles('EN')).toHaveLength(MEDIA_CATALOG.length);
    expect(listMediaTitles('it')).toHaveLength(0);
  });

  it('looks titles up by id', () => {
    const first = MEDIA_CATALOG[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    expect(getMediaTitle(first.id)).toBe(first);
    expect(getMediaTitle('missing-title')).toBeUndefined();
  });
});
