---
name: media-recs
description: Use when working on film, series, or book recommendations, taste profile, availability, spoilers, feedback, or the media catalog. Triggers include media, recommendation, film, series, book, taste, spoiler, availability, immersion.
---

# Media recommendations

## Principles

- Level fit first: 90-95% known vocabulary (coverage 0.88-0.97).
- Taste matters; legal availability only; no spoilers; no full transcripts.
- Watching/reading = input XP, not production streak. A 60 s spoken / 80-word written
  reflection counts as production.
- Immediate, not punitive policy.

## Ranking

```
score = 0.35*levelFit + 0.25*tasteMatch + 0.15*gapFit
      + 0.10*quality + 0.10*diversity + 0.05*freshness
```

- Deterministic in `packages/core/src/recommendation`.
- 10% exploration; hard filters: region availability, age, dislikes, rejected/finished.
- LLM writes only the spoiler-free reason and guide; availability comes from the DB.

## Feedback

- accepted/rejected/too easy/too hard/finished/abandoned.
- Genre/theme weights update; too-hard lowers target coverage; rejected excluded 90 days.
- Store score components in `recommendations.score_json`.

## Data

`media_titles`, `media_title_tags`, `media_availability`, `media_guides`, `media_phrases`,
`user_taste_profile`, `recommendations`, `recommendation_feedback`, `media_progress`.

## Tests

- Level fit 0.88-0.97; top-5 diversity; rejected excluded.
- Legal availability in region; no piracy/full transcripts.
- No spoilers on sampled guides; feedback changes next ranking.
- Reflection counts as production; phrases become SRS cards.
