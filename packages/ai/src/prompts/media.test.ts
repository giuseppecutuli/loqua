import { describe, expect, it } from 'vitest';

import { getPrompt } from '../registry.js';
import { mediaExplainInputSchema, mediaExplanationSchema } from './media.explain.js';
import { mediaGuideInputSchema, mediaGuideSchema } from './media.guide.js';
import { mediaReflectInputSchema, mediaReflectionSchema } from './media.reflect.js';

const explainInput = {
  targetLang: 'en',
  nativeLang: 'it',
  uiLocale: 'it',
  explanationMode: 'target_simple' as const,
  learner: {
    level: 'B1' as const,
    difficultyTolerance: 'balanced' as const,
    interests: ['comedy', 'travel'],
    weeklyMinutes: 120,
    weakConcepts: ['reported speech'],
    recentErrorTypes: ['tense'],
  },
  candidate: {
    id: 'movie-42',
    kind: 'movie' as const,
    title: 'A Quiet Trip',
    year: 2018,
    synopsis: 'A traveller explores a new city and meets unexpected people.',
    genres: ['comedy'],
    themes: ['travel', 'friendship'],
    difficultyBand: 'B1' as const,
    coverage: 0.92,
    durationMinutes: 98,
    contentWarnings: [],
    availabilityProviders: ['legal-provider'],
  },
  constraints: { noSpoilers: true as const, legalOnly: true as const },
};

const explainOutput = {
  mediaId: 'movie-42',
  whyItFits: 'Fits your B1 level and taste for comedy and travel.',
  levelNote: 'About 92% of words at your level.',
  approach: 'Watch with target-language subtitles and pause on new chunks.',
  phrasesToNotice: [
    'Could you repeat that?',
    'I would rather...',
    'What does that mean?',
    'Can we slow down?',
    'I think that...',
  ],
  spoilerFree: true as const,
};

const guideInput = {
  targetLang: 'en',
  nativeLang: 'it',
  uiLocale: 'it',
  explanationMode: 'native' as const,
  learner: { level: 'B1' as const, weeklyMinutes: 120 },
  media: {
    id: 'movie-42',
    kind: 'movie' as const,
    title: 'A Quiet Trip',
    synopsis: 'A traveller explores a new city and meets unexpected people.',
    difficultyBand: 'B1' as const,
    coverage: 0.92,
    durationMinutes: 98,
  },
  targetConcepts: [
    { code: 'en.gram.tense.present_perfect', label: 'Present perfect' },
    { code: 'en.func.requests', label: 'Polite requests' },
    { code: 'en.vocab.travel', label: 'Travel vocabulary' },
  ],
  functionalPhrases: ['Could you repeat that?', 'I would rather...', 'What does that mean?'],
};

const guideOutput = {
  mediaId: 'movie-42',
  before: ['Read the synopsis and predict three words.', 'Review the target concept notes.'],
  during: ['Pause after each scene and note one chunk.', 'Mark phrases you want to reuse.'],
  after: ['Summarise the setup in five sentences.', 'Retell one scene from memory.'],
  targetConcepts: ['en.gram.tense.present_perfect', 'en.func.requests', 'en.vocab.travel'],
  functionalPhrases: [
    'Could you repeat that?',
    'I would rather...',
    'What does that mean?',
    'Can we slow down?',
    'I think that...',
  ],
  comprehensionPrompts: [
    'Who are the main characters in the setup?',
    'What is the traveller looking for?',
    'Which phrases show polite requests?',
  ],
  reflectionTask: 'Speak for 60 seconds about the main idea, or write 80 words.',
  spoilerFree: true as const,
};

const reflectInput = {
  targetLang: 'en',
  nativeLang: 'it',
  explanationMode: 'target_simple' as const,
  learner: { level: 'B1' as const },
  media: { title: 'A Quiet Trip', kind: 'movie' as const },
  responseText: 'I have went to the cinema and I liked the story about the traveller.',
  durationSec: 60,
  ruleIds: ['en.gram.tense.present_perfect'],
};

const reflectOutput = {
  countsAsProduction: true as const,
  estimatedLevel: 'B1' as const,
  dimensions: {
    taskAchievement: 4,
    coherence: 3,
    range: 3,
    accuracy: 3,
    fluency: 4,
  },
  strengths: ['Clear main idea.', 'Good use of connected sentences.'],
  priorities: ['Use the present perfect correctly.'],
  errors: [
    {
      span: 'I have went',
      errorType: 'tense',
      ruleId: 'en.gram.tense.present_perfect',
      suggestion: 'I went',
      explanationText: 'Use the simple past with a finished time.',
      severity: 'medium' as const,
      confidence: 0.9,
    },
  ],
  praise: 'You expressed your opinion clearly.',
  nextFocus: ['Present perfect vs simple past.'],
};

describe('media prompts registration', () => {
  it('registers media.explain@1 and parses a valid input', () => {
    const prompt = getPrompt('media.explain', 1);
    const parsed = prompt.parseInput(explainInput) as typeof explainInput;
    expect(parsed.candidate.id).toBe('movie-42');
    expect(prompt.renderUser(explainInput)).toContain('movie-42');
    expect(prompt.renderUser(explainInput)).toContain('B1');
  });

  it('registers media.guide@1 and parses a valid input', () => {
    const prompt = getPrompt('media.guide', 1);
    const parsed = prompt.parseInput(guideInput) as typeof guideInput;
    expect(parsed.media.id).toBe('movie-42');
    expect(prompt.renderUser(guideInput)).toContain('movie-42');
    expect(prompt.renderUser(guideInput)).toContain('B1');
  });

  it('registers media.reflect@1 and parses a valid input', () => {
    const prompt = getPrompt('media.reflect', 1);
    const parsed = prompt.parseInput(reflectInput) as typeof reflectInput;
    expect(parsed.media.title).toBe('A Quiet Trip');
    expect(prompt.renderUser(reflectInput)).toContain('B1');
    expect(prompt.renderUser(reflectInput)).toContain('A Quiet Trip');
  });
});

describe('media prompt schemas', () => {
  it('accepts valid explain output and rejects invalid variants', () => {
    expect(mediaExplanationSchema.safeParse(explainOutput).success).toBe(true);
    expect(mediaExplanationSchema.safeParse({ ...explainOutput, mediaId: 42 }).success).toBe(false);
    expect(mediaExplanationSchema.safeParse({ ...explainOutput, spoilerFree: false }).success).toBe(
      false,
    );
    expect(
      mediaExplanationSchema.safeParse({
        ...explainOutput,
        phrasesToNotice: explainOutput.phrasesToNotice.slice(0, 4),
      }).success,
    ).toBe(false);
  });

  it('accepts valid guide output and rejects invalid variants', () => {
    expect(mediaGuideSchema.safeParse(guideOutput).success).toBe(true);
    expect(mediaGuideSchema.safeParse({ ...guideOutput, mediaId: 42 }).success).toBe(false);
    expect(mediaGuideSchema.safeParse({ ...guideOutput, spoilerFree: false }).success).toBe(false);
    expect(mediaGuideSchema.safeParse({ ...guideOutput, before: ['only one'] }).success).toBe(false);
    expect(
      mediaGuideSchema.safeParse({
        ...guideOutput,
        targetConcepts: guideOutput.targetConcepts.slice(0, 2),
      }).success,
    ).toBe(false);
    expect(
      mediaGuideSchema.safeParse({
        ...guideOutput,
        functionalPhrases: guideOutput.functionalPhrases.slice(0, 4),
      }).success,
    ).toBe(false);
    expect(
      mediaGuideSchema.safeParse({
        ...guideOutput,
        comprehensionPrompts: guideOutput.comprehensionPrompts.slice(0, 2),
      }).success,
    ).toBe(false);
  });

  it('accepts valid reflection output and rejects invalid variants', () => {
    expect(mediaReflectionSchema.safeParse(reflectOutput).success).toBe(true);
    expect(
      mediaReflectionSchema.safeParse({ ...reflectOutput, countsAsProduction: false }).success,
    ).toBe(false);
    expect(
      mediaReflectionSchema.safeParse({ ...reflectOutput, estimatedLevel: 'Z9' }).success,
    ).toBe(false);
    expect(
      mediaReflectionSchema.safeParse({ ...reflectOutput, strengths: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false);
    expect(
      mediaReflectionSchema.safeParse({ ...reflectOutput, priorities: ['a', 'b', 'c'] }).success,
    ).toBe(false);
    expect(
      mediaReflectionSchema.safeParse({ ...reflectOutput, nextFocus: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false);
  });
});

describe('media prompt system prompts', () => {
  const specs = [
    getPrompt('media.explain', 1),
    getPrompt('media.guide', 1),
    getPrompt('media.reflect', 1),
  ];

  it.each(specs.map((spec) => [spec.id, spec] as const))(
    '%s is JSON-only, spoiler-free, piracy-free and language-agnostic',
    (_id, spec) => {
      expect(spec.systemPrompt).toContain('JSON');
      expect(spec.systemPrompt.toLowerCase()).toContain('spoiler');
      expect(spec.systemPrompt.toLowerCase()).toContain('piracy');
      expect(spec.systemPrompt.toLowerCase()).not.toContain('english');
    },
  );
});

describe('media prompt input schemas', () => {
  it('parse their valid inputs', () => {
    expect(mediaExplainInputSchema.safeParse(explainInput).success).toBe(true);
    expect(mediaGuideInputSchema.safeParse(guideInput).success).toBe(true);
    expect(mediaReflectInputSchema.safeParse(reflectInput).success).toBe(true);
  });
});
