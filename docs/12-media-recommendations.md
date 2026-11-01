# Media recommendations (watch & read)

Feature: recommend movies, series, and books that fit the learner's level, gaps, tastes, and
available time; explain why; learn from feedback; turn consumption into practice.

It is **comprehensible input**, not passive entertainment. The target is 90-95% known
vocabulary (i+1), enjoyment first, and a short production step after each session.

## 1. Principles

1. **Level fit first.** A title that is too hard is not a recommendation. The catalog spans A1-C1
and each title stores coverage per CEFR band.
2. **Taste matters.** The best title is one the learner will actually finish.
3. **No spoilers.** Reasons and guides never reveal plot events.
4. **Legal only.** Metadata and legal availability; no piracy, no full transcripts.
5. **Input is not production.** Watching/reading earns input XP but does not extend the
   production streak. A 60-second reflection does.
6. **Feedback changes the model.** Rejections, difficulty feedback, and completion update the
   taste profile and difficulty target.
7. **Diversity.** Avoid five thrillers in a row; expose the learner to variety.

## 2. Taste onboarding

Added as a step after the placement test (skippable, editable later).

| Input | Values | Use |
|---|---|---|
| Formats | movie, series, book | candidate filter |
| Genres | comedy, drama, thriller, sci-fi, fantasy, documentary, romance, crime, biography, business, tech, history, sport | taste vector |
| Themes | work, travel, daily life, relationships, humor, mystery, society, science | taste vector |
| Difficulty tolerance | easy, balanced, challenging | target coverage |
| Subtitles | target, native, both, none | level fit and UX |
| Weekly time | 30-900 minutes | length filter |
| Dislikes | horror, gore, musical, slow pace, ... | hard filter / penalty |
| Region | ISO country | availability filter |
| Accent preference | US, UK, Australian, mixed | listening fit |

The taste profile is stored in `user_taste_profile` and is editable in Settings.

## 3. Candidate model

Each title has:

- `kind`, `target_lang`, `title`, `original_title`, `release_year`
- spoiler-free `synopsis_native`
- `difficulty_band`, `difficulty_score`, `coverage_json` by CEFR level
- `speech_rate_wpm` (audio), `duration_minutes` / `episode_count` / `page_count`
- `age_rating`, `content_warnings_json`
- `genres_json`, `themes_json`, normalized `media_title_tags`
- `editorial_quality` (1-5, curated)
- legal `media_availability` by region/provider/access type

Coverage is the estimated share of words known at the learner's level. It is estimated from
subtitles/transcripts during catalog curation (not stored in the app) and from book samples;
only the aggregate estimate is stored.

## 4. Ranking (deterministic)

Ranking runs in `packages/core/src/recommendation`; no AI call. The LLM only writes the reason
and the guide.

```
targetCoverage =
  easy: 0.96
  balanced: 0.93
  challenging: 0.90

levelFit = exp(-((coverage(level) - targetCoverage)^2) / (2 * 0.06^2))
tasteMatch = cosine(userTasteVector, mediaTagVector) normalized to [0,1]
gapFit = overlap(media tags/concepts, weak concepts + recent error types) normalized to [0,1]
quality = editorial_quality / 5
diversity = 1 - maxSimilarity(media, last 5 recommendations)
freshness = 1 if availability checked < 90 days ago else 0.5

score = 0.35 * levelFit
      + 0.25 * tasteMatch
      + 0.15 * gapFit
      + 0.10 * quality
      + 0.10 * diversity
      + 0.05 * freshness
```

`gapFit` is how the recommendation reflects what the app understood about the learner: weak
concepts, recent error types, and target skills. It is a small weight: enjoyment still wins,
but a title that naturally exposes the learner to a weak area gets a nudge.

Hard filters (excluded):

- no legal availability in the learner's region;
- age rating above the learner's setting;
- disliked genre/theme;
- rejected, finished, or abandoned in the last 90 days;
- duration far above the weekly time budget (unless the learner accepts a multi-week plan).

Exploration:

- 10% epsilon-greedy: pick a random eligible genre not shown recently.
- Or Thompson sampling per genre arm after enough feedback.
- Cold start: curated popular titles per level, diversified by genre and format.

Diversity rules:

- At most 2 titles per genre in the top 5.
- At most 1 title per franchise/author in the top 5.
- Mix formats when the learner selected more than one.

Edge cases:

- No titles at level: recommend one band easier with a note.
- No availability: show "non disponibile nella tua regione" and offer a similar title.
- All rejected: reset exploration and ask for taste feedback.
- Book too long: propose a shorter book or a series of short sessions.

## 5. LLM role

### `media.explain`

Input: learner level, target/native language, taste summary, candidate metadata (no plot
details beyond the spoiler-free synopsis), difficulty estimate, availability.

Output (validated):

```ts
type MediaExplanation = {
  mediaId: string;
  whyItFits: string;        // max 2 sentences, UI locale
  levelNote: string;        // e.g. "circa il 92% delle parole al tuo livello"
  approach: string;         // how to watch/read (subtitles, chunks, pauses)
  phrasesToNotice: string[]; // 5 generic functional phrases, not exact dialogue
  spoilerFree: true;
};
```

Rules: no spoilers, no invented availability, no claims beyond metadata, no full dialogue,
no piracy, no medical/legal advice. If validation fails, show the deterministic reason.

### `media.guide`

Generated when the learner accepts a title; cached per media + level.

```ts
type MediaGuide = {
  mediaId: string;
  before: string[];          // 2-3 preparation steps
  during: string[];          // active watching/reading instructions
  after: string[];           // reflection and retrieval tasks
  targetConcepts: string[];  // 3 concept codes
  functionalPhrases: string[]; // generic functions, not copyrighted lines
  comprehensionPrompts: string[]; // 3-5 spoiler-free questions
  reflectionTask: string;    // 60-second speaking or 80-word writing
};
```

The guide turns consumption into practice:

1. Before: preview 5 words/functions.
2. During: subtitles strategy, pause points, note 3 phrases.
3. After: 60-second spoken summary or 80-word written summary (production streak), 5
   comprehension questions, save phrases to SRS.
4. Link 3 concepts to the learner model (`media_title_tags` -> concepts).

## 6. Feedback loop

Events: shown, accepted, rejected, started, finished, abandoned; rating 1-5; difficulty
feedback (too easy / ok / too hard); free-text reason.

Updates:

- Accepted/finished: genre/theme weights +0.08.
- Rejected: -0.15 for the dominant genre/theme; exclude for 90 days.
- Rating: weighted update scaled by (rating - 3) / 2.
- Too hard: target coverage -0.02 (floor 0.88), and prefer shorter titles.
- Too easy: target coverage +0.02 (ceiling 0.97), and prefer higher bands.
- Weekly decay: weights *= 0.95, then renormalize.
- Implicit: abandoning before 20% counts as a mild negative; finishing counts as a strong positive.

The model is explainable: `recommendations.score_json` stores the component scores.
Taste profile, recommendations, feedback, and media progress sync across devices; ranking is
recomputed from the synced inputs.

## 7. Learning integration

- Watching/reading: input XP (`immersion`), no streak extension.
- Reflection: 60 seconds spoken or 80 words written -> production streak + AI correction.
- Phrases: user-saved short quotes -> `saved_phrases` -> SRS cards.
- Concepts: 3 target concepts per guide, linked to the knowledge graph.
- Mini-quiz: 5 comprehension questions, no copyrighted text.
- Next step: after finishing, recommend a slightly harder title or a related format.

## 8. UX summary

- Entry point: Practice -> "Immersione" segmented tab (no sixth bottom tab).
- Onboarding: taste step after assessment.
- Card: poster/cover, title, kind, level badge, duration, "perché", availability, actions
  (Salva, Inizia, Non mi interessa, Troppo difficile).
- Detail: spoiler-free synopsis, guide, phrases, progress, feedback.
- Progress: "In corso", "Finiti", "Abbandonati"; weekly minutes.
- Empty/error: no catalog, no availability in region, no titles at level.
- Offline: cached recommendations and guides; availability may be stale.

## 9. Safety and legal

- Metadata only; no full transcripts, no chapter text, no subtitle dumps.
- Short user-entered quotes are allowed for personal study.
- Legal providers only; region-aware; no piracy links.
- Age ratings and content warnings respected.
- No spoilers in reasons/guides; validate with a spoiler heuristic + human spot-check.
- No medical, legal, or financial advice.
- The learner can delete taste data and recommendation history.

## 10. Cost

| Operation | Model tier | Frequency | Cost |
|---|---|---|---|
| Ranking | none (deterministic) | per request | $0 |
| `media.explain` | fast | per recommendation batch, cached | < $0.001 |
| `media.guide` | balanced | per accepted title, cached per media+level | ~$0.002 |
| Reflection | existing correction/eval | per session | existing budget |

Target: < $0.01 per active user per day for recommendations.

## 11. Evaluation

Offline golden set: 50 titles, 10 taste profiles, 5 regions.

| Metric | Threshold |
|---|---|
| Level fit (coverage 0.88-0.97) | ≥ 90% |
| Taste relevance (human/judge) | ≥ 80% |
| Diversity in top 5 | ≥ 4 distinct genres |
| No spoilers | 100% on sampled guides |
| Legal availability present | 100% |
| No piracy/full transcript | 100% |
| Explanation grounded in metadata | ≥ 95% |

Online metrics:

- Recommendation acceptance ≥ 25%.
- Completion ≥ 40% of started titles.
- Post-media reflection completion ≥ 30%.
- Saved phrases per finished title ≥ 3.
- "Too hard" rate ≤ 20%.

## 12. Contracts

```ts
type MediaCandidate = {
  id: string;
  kind: 'movie' | 'series' | 'book';
  targetLang: string;
  difficultyScore: number;
  coverage: Record<string, number>;
  editorialQuality: number;
  genres: string[];
  themes: string[];
  durationMinutes?: number;
  episodeCount?: number;
  pageCount?: number;
  ageRating?: string;
  availabilityRegions: string[];
};

type RecommendationRequest = {
  profile: LearnerProfile;
  level: string;
  targetCoverage: number;
  tastes: TasteProfile;
  weakConcepts: string[];
  recentErrorTypes: string[];
  region: string;
  history: RecommendationHistory;
  weeklyMinutes: number;
  limit: number;
};

export function rankMedia(
  candidates: MediaCandidate[],
  request: RecommendationRequest
): ScoredRecommendation[];

export function updateTaste(
  tastes: TasteProfile,
  feedback: RecommendationFeedback
): TasteProfile;
```

All functions are pure and deterministic given the same inputs. Random exploration uses an
injected seed for testability.

## 13. Data

Tables: `media_titles`, `media_title_tags`, `media_availability`, `media_guides`,
`media_phrases`, `user_taste_profile`, `recommendations`, `recommendation_feedback`,
`media_progress`, `saved_phrases`, `srs_cards` (source `media_phrase`).
