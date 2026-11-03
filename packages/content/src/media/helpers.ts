import {
  type CefrLevel,
  type MediaCandidate,
  type MediaGenre,
  type MediaKind,
  type MediaTheme,
  type SubtitlePref,
} from '@loqua/core';

export const MEDIA_AVAILABILITY_REGIONS = ['IT', 'US', 'GB', 'FR', 'DE', 'ES'] as const;

export type MediaAccessType = 'subscription' | 'rent' | 'buy' | 'free' | 'library';

export interface MediaAvailability {
  readonly region: string;
  readonly provider: string;
  readonly accessType: MediaAccessType;
  readonly priceNote?: string;
}

export type MediaCatalogEntry = MediaCandidate & {
  readonly originalTitle?: string;
  readonly releaseYear: number;
  readonly subtitleAvailability: readonly SubtitlePref[];
  readonly synopsis: string;
  readonly licenseNote: string;
  readonly reviewStatus: 'approved';
  readonly availability: readonly MediaAvailability[];
};

const PROVIDER_ACCESS = {
  Netflix: 'subscription',
  'Prime Video': 'subscription',
  'Disney+': 'subscription',
  'Apple TV+': 'subscription',
  Max: 'subscription',
  'Paramount+': 'subscription',
  MUBI: 'subscription',
  Kanopy: 'library',
  'Kindle Store': 'buy',
  Kobo: 'buy',
  'Apple Books': 'buy',
  'Google Play Books': 'buy',
  Libby: 'library',
  Audible: 'subscription',
  'YouTube Movies': 'rent',
} as const satisfies Record<string, MediaAccessType>;

type AllowedProvider = keyof typeof PROVIDER_ACCESS;

export const GENERAL_STREAMING: readonly AllowedProvider[] = [
  'Netflix',
  'Prime Video',
  'Apple TV+',
  'Max',
  'YouTube Movies',
  'Kanopy',
];

export const FAMILY_STREAMING: readonly AllowedProvider[] = [
  'Disney+',
  'Prime Video',
  'Apple TV+',
  'Netflix',
  'YouTube Movies',
  'Kanopy',
];

export const INDEPENDENT_STREAMING: readonly AllowedProvider[] = [
  'Netflix',
  'Prime Video',
  'MUBI',
  'Apple TV+',
  'YouTube Movies',
  'Kanopy',
];

export const BOOK_RETAIL: readonly AllowedProvider[] = [
  'Kindle Store',
  'Libby',
  'Kobo',
  'Apple Books',
  'Google Play Books',
  'Audible',
];

export const BOOK_LIBRARY: readonly AllowedProvider[] = [
  'Kindle Store',
  'Apple Books',
  'Libby',
  'Kobo',
  'Audible',
  'Google Play Books',
];

export const STREAMING_LICENSE_NOTE =
  'Original editorial summary for Loqua; streaming access via licensed providers listed by region.';
export const BOOK_LICENSE_NOTE =
  'Original editorial summary for Loqua; e-book and audiobook access via licensed retailers and libraries.';

const COVERAGE_BY_BAND: Record<CefrLevel, Record<CefrLevel, number>> = {
  A1: { A1: 0.94, A2: 0.95, B1: 0.96, B2: 0.97, C1: 0.98 },
  A2: { A1: 0.8, A2: 0.93, B1: 0.95, B2: 0.96, C1: 0.97 },
  B1: { A1: 0.64, A2: 0.79, B1: 0.92, B2: 0.95, C1: 0.96 },
  B2: { A1: 0.5, A2: 0.66, B1: 0.81, B2: 0.92, C1: 0.95 },
  C1: { A1: 0.38, A2: 0.53, B1: 0.69, B2: 0.84, C1: 0.93 },
};

const DIFFICULTY_BY_BAND: Record<CefrLevel, number> = {
  A1: 0.16,
  A2: 0.3,
  B1: 0.5,
  B2: 0.7,
  C1: 0.88,
};

export interface MediaSeed {
  readonly id: string;
  readonly kind: MediaKind;
  readonly title: string;
  readonly originalTitle?: string;
  readonly releaseYear: number;
  readonly synopsis: string;
  readonly difficultyBand: CefrLevel;
  readonly difficultyScore?: number;
  readonly editorialQuality: number;
  readonly languageVariety: string;
  readonly subtitleAvailability?: readonly SubtitlePref[];
  readonly genres: readonly MediaGenre[];
  readonly themes: readonly MediaTheme[];
  readonly conceptTags: readonly string[];
  readonly durationMinutes?: number;
  readonly episodeCount?: number;
  readonly episodeMinutes?: number;
  readonly pageCount?: number;
  readonly ageRating: string;
  readonly contentWarnings: readonly string[];
  readonly availability: readonly MediaAvailability[];
  readonly licenseNote: string;
  readonly franchise?: string;
  readonly freshnessDays?: number;
}

function pickProvider(
  providers: readonly AllowedProvider[],
  index: number,
): AllowedProvider {
  const provider = providers[index % providers.length];
  if (provider === undefined) {
    throw new Error('At least one availability provider is required');
  }
  return provider;
}

export function buildAvailability(providers: readonly AllowedProvider[]): readonly MediaAvailability[] {
  return MEDIA_AVAILABILITY_REGIONS.map((region, index) => {
    const provider = pickProvider(providers, index);
    return {
      region,
      provider,
      accessType: PROVIDER_ACCESS[provider],
    };
  });
}

export function defineMedia(seed: MediaSeed): MediaCatalogEntry {
  const availabilityRegions = [
    ...new Set(seed.availability.map((row) => row.region.toUpperCase())),
  ];
  const availabilityProviders = [...new Set(seed.availability.map((row) => row.provider))];

  return {
    id: seed.id,
    kind: seed.kind,
    targetLang: 'en',
    title: seed.title,
    ...(seed.originalTitle === undefined ? {} : { originalTitle: seed.originalTitle }),
    releaseYear: seed.releaseYear,
    difficultyBand: seed.difficultyBand,
    difficultyScore: seed.difficultyScore ?? DIFFICULTY_BY_BAND[seed.difficultyBand],
    coverage: { ...COVERAGE_BY_BAND[seed.difficultyBand] },
    editorialQuality: seed.editorialQuality,
    languageVariety: seed.languageVariety,
    subtitleAvailability: seed.subtitleAvailability ?? ['target', 'native'],
    genres: [...seed.genres],
    themes: [...seed.themes],
    conceptTags: [...seed.conceptTags],
    ...(seed.durationMinutes === undefined ? {} : { durationMinutes: seed.durationMinutes }),
    ...(seed.episodeCount === undefined ? {} : { episodeCount: seed.episodeCount }),
    ...(seed.episodeMinutes === undefined ? {} : { episodeMinutes: seed.episodeMinutes }),
    ...(seed.pageCount === undefined ? {} : { pageCount: seed.pageCount }),
    ageRating: seed.ageRating,
    contentWarnings: [...seed.contentWarnings],
    availabilityRegions,
    availabilityProviders,
    ...(seed.freshnessDays === undefined ? {} : { freshnessDays: seed.freshnessDays }),
    ...(seed.franchise === undefined ? {} : { franchise: seed.franchise }),
    synopsis: seed.synopsis,
    licenseNote: seed.licenseNote,
    reviewStatus: 'approved',
    availability: seed.availability,
  };
}

