# Learning experience and real coverage

This document turns the content audit into a concrete plan: what "enough" means, how the bank
must be shaped, and what the learner should experience at each CEFR level. It is the reference
for the next content batches and UX work.

## 1. What the research says

| Evidence                                                                                                                                                                                                                                                                              | Implication for Loqua                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| CEFR describes ability through observable can-do statements, not grammar lists alone ([Council of Europe](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions), [Cambridge English](https://www.cambridgeenglish.org/exams-and-tests/cefr/)). | Coverage is measured by level x skill x can-do x concept, not only by item count.                           |
| Retrieval practice is more effective than re-reading; difficulty is desirable ([retrievalpractice.org](https://www.retrievalpractice.org/why-it-works), [Learning Scientists](https://www.learningscientists.org/blog/2016/6/23-1)).                                                  | Sessions ask the learner to produce/choose from memory; avoid passive explanation-only screens.             |
| Spaced repetition schedules reviews near forgetting; FSRS models difficulty, stability and retrievability ([FSRS](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)).                                                                                        | Every item/answer must feed SRS; review is a first-class block, not an add-on.                              |
| Interleaving and varied practice improve transfer more than blocked repetition.                                                                                                                                                                                                       | Mix skills, contexts and item types inside a session; avoid 20 identical cloze items.                       |
| Corrective feedback works best when focused, timely and limited; over-correction is noisy.                                                                                                                                                                                            | Show one or two focus points, immediate feedback for form, delayed feedback for fluency.                    |
| Comprehensible input at i+1 and high-frequency language build confidence ([Krashen](https://www.sdkrashen.com/)).                                                                                                                                                                     | A1/A2 use short, concrete input with visual/context support; B2/C1 use richer inference.                    |
| Learner autonomy, competence and relatedness sustain motivation ([Self-Determination Theory](https://selfdeterminationtheory.org/)).                                                                                                                                                  | No hearts, no punishment, no global leaderboards; show progress and let the learner choose a short session. |
| Cognitive load is limited; novices need worked examples and scaffolding.                                                                                                                                                                                                              | A1/A2 get models, hints and translation toggles; B2/C1 get less scaffolding and more strategy.              |

> The practical theme/scenario/combination map is in `docs/18-content-blueprint.md`.

## 2. Coverage model

A content unit is only "covered" when all of these exist:

- **Level**: A1, A2, B1, B2, C1.
- **Skill**: grammar, vocabulary, reading, listening, speaking, writing, pragmatics.
- **Can-do**: at least one observable statement per level/skill cluster.
- **Concept**: linked to the knowledge graph and prerequisite edges.
- **Evidence**: receptive and productive tasks, not only recognition.
- **Review status**: approved after automated gates and sampled human review.
- **Modality**: text, audio, spoken response, written response where relevant.

### The old 600 / 200 target was too low

600 practice items at 6-12 items/day is roughly 2-3 months before meaningful repetition, while
CEFR-guided learning to B1 is commonly estimated at 350-400 hours and B2 at 500-600 hours. A
bank of 600 items cannot sustain that journey with varied contexts. 200 assessment items (40
per level) is also thin for stable calibration. Five items per concept is a coverage floor, not
retention: a concept needs repeated retrieval in different contexts over time.

### Revised target: beta and public

| Area                     | Baseline | Private beta | Public v1 |
| ------------------------ | -------: | -----------: | --------: |
| Practice items           |      600 |    **2,400** | **3,500** |
| Assessment items         |      200 |      **600** |   **800** |
| Listening items          |       92 |      **300** |   **600** |
| Speaking tasks           |        0 |      **150** |   **250** |
| Writing tasks            |        1 |      **100** |   **150** |
| Real-life scenarios      |        0 |       **60** |   **100** |
| Can-do statements        |       28 |      **280** |   **420** |
| Knowledge-graph concepts |       76 |      **150** |   **220** |

"Guided hours" are not a promise: they are the comparable CEFR effort the content must support.

| Level     | Comparable guided hours | Recognition vocabulary | Active vocabulary | Practice target | Assessment target |
| --------- | ----------------------: | ---------------------: | ----------------: | --------------: | ----------------: |
| A1        |                  90-100 |                    500 |               300 |             450 |               120 |
| A2        |                 180-200 |                  1,000 |               600 |             550 |               120 |
| B1        |                 350-400 |                  2,000 |             1,200 |             650 |               120 |
| B2        |                 500-600 |                  3,500 |             2,000 |             450 |               120 |
| C1        |                 700-800 |                  5,000 |             3,000 |             300 |               120 |
| **Total** |                         |                        |                   |       **2,400** |           **600** |

Lexical targets are syllabus goals: not every word needs a standalone item, but every target
word needs repeated exposure in input, retrieval and production.

### Beta practice mix

| Area       | Items / tasks |
| ---------- | ------------: |
| Grammar    |           700 |
| Vocabulary |           600 |
| Reading    |           350 |
| Listening  |           300 |
| Speaking   |           150 |
| Writing    |           100 |
| Pragmatics |           200 |
| **Total**  |     **2,400** |

Minimum quality bar:

- 8-12 exposures per core concept across contexts, item types and modalities.
- 5+ practice items per concept and 2+ assessment items per concept.
- 3+ item types per level; every level includes receptive and productive work.
- Every listening item has audio/transcript; every speaking task has STT or typed fallback.
- Every writing task has a rubric and one focus point.
- Every level has real-life scenarios, not only grammar drills.
- 10% human review per level/skill before public release.

### Skill mix

- Grammar and vocabulary: the largest share, but always in context.
- Reading and listening: graded input, gist + detail + inference.
- Speaking and writing: rubric-scored production, not multiple choice disguised as output.
- Pragmatics: requests, hedging, disagreement, register, implicit meaning.

### Current gaps (2026-11)

- 10 concepts have no items: 5 speaking, 5 writing. Listening is seeded with 25 items.
- Practice is **600 approved items** in the DB; every text/listening concept has at least 5
  practice items. Assessment is 200. This meets the M2 baseline, not the beta target.
- The beta target is 2,400 practice + 600 assessment; current is **25% of beta practice** and
  **33% of beta assessment**. Listening is 92/300; speaking/writing have no tasks yet.
- Assessment is text-only and not calibrated.
- All content is approved after automated gates; the 10% human sample is pending.

## 3. Level playbooks

Every level has a life spine. Work/technical, academic, exam and media are **goal tracks** selected
from the learner profile; see `docs/18-content-blueprint.md` sections 1.3-1.4. A1/A2 stay mostly
daily life; B1-C1 can reach 50% technical/academic when the goal requires it.

### A1 — survive and build confidence

- 3-5 minute micro-sessions; one new concept at a time.
- High-frequency concrete vocabulary, greetings, numbers, routines, directions.
- Audio-first for listening; target-language text plus optional native hint.
- Heavy scaffolding: model answer, first-letter hint, translation toggle, repeat audio.
- Immediate feedback with one correction and one example.
- Success criterion: the learner can do the can-do in a familiar context, not explain grammar.

### A2 — guided interaction

- Short dialogues and sentence building; controlled production.
- Listening with transcript toggle and slower replay.
- Writing: 3-5 connected sentences with a model and checklist.
- Feedback focuses on meaning first, then one form issue.
- Introduce simple self-correction: "What would you change?"

### B1 — independence

- Connected texts and functional can-dos: plans, experiences, opinions, problems.
- Less translation; explanations in simple target language by default.
- Speaking: 30-60 second prompts with a structure, not a script.
- Writing: informal email/paragraph with rubric and two focus points.
- SRS review becomes visible; errors feed micro-drills.

### B2 — nuance and strategy

- Authentic-like articles, talks and discussions; inference and stance.
- Collocation, register, hedging, concession, summarizing.
- Speaking: argue a position, respond to a counterpoint.
- Writing: structured text with cohesion and register.
- Minimal scaffolding; hints are strategy hints, not answers.

### C1 — precision and flexibility

- Complex texts, implicit meaning, irony, style and register shifts.
- Summarize, synthesize, reformulate, disagree precisely.
- Speaking: extended turns with self-repair and emphasis adjustment.
- Writing: professional/argumentative text with audience awareness.
- No translation by default; feedback targets precision and naturalness.

## 4. Cross-level experience principles

1. **One new thing per session.** A session has review, new input and production, but only one
   genuinely new concept.
2. **Always show why.** Each item carries a rationale code: due review, weak skill, new concept,
   production practice, error drill, fallback.
3. **Scaffold, then remove.** A1/A2 get models and hints; B2/C1 get strategy prompts.
4. **Feedback budget.** One success + one improvement; never a wall of red corrections.
5. **Audio controls.** Play, slow, replay; transcript toggle after the first attempt.
6. **Speaking without punishment.** STT errors are treated as intelligibility estimates; text
   fallback is allowed.
7. **Writing with a rubric.** Task achievement, coherence, range, accuracy; one focus point.
8. **Visible can-do progress.** The learner sees "I can..." statements, not only XP.
9. **Resume anywhere.** Session state is server-backed; reload restores the pending item.
10. **Accessibility.** Large touch targets, captions, keyboard support, contrast, reduced motion.

## 5. What to add to simplify learning

- **A1/A2 "show me" button**: model answer or native hint before answering, with a rating penalty.
- **Listening player**: TTS/audio with speed control and transcript after first try.
- **Speaking card**: record -> transcript -> rubric; typed fallback when STT is unavailable.
- **Writing card**: prompt, checklist, word count, rubric feedback, one focus point.
- **Can-do map**: per level, show mastered / in progress / not started.
- **Error bank view**: recurring errors with one-tap drill.
- **Micro-session mode**: 3-5 minutes when the learner is tired.
- **Level-up check**: a short test-out that unlocks the next band without resetting progress.
- **Personal context**: interests and goal change examples, not the underlying coverage.

## 6. Content operations

- Authored content lives in Git as typed packs; tests validate schema, concept links, levels,
  unique answers, prompts and difficulty.
- Packs are imported into Postgres as immutable `content_packs` with version + checksum.
- Runtime reads only the DB; Studio is for review, not for editing rows the next seed overwrites.
- Rollback activates the previous pack; attempts and SRS history are never deleted.
- Human review samples 10% per level/skill; approved items are the only ones served.
- The coverage gate blocks a release when level/skill/concept/can-do thresholds are not met.

## 7. Next batches

**Current baseline (2026-11).** `pnpm content:coverage:target` reports 840 approved items:
640 practice + 200 assessment, 103 listening, 0 speaking, 0 writing. The gap to the beta
target is 1,760 practice, 400 assessment, 197 listening, 150 speaking and 100 writing.
Production modes now have a usable base (transformation 15, word_order 13, dictation 11),
but reuse_lexicon still has one item and needs semantic grading before scale. Extend
reuse_lexicon, then listening/speaking/writing, through the reviewed content-pack workflow,
not unreviewed ad-hoc items.

1. **Practice to beta (2,400)**: grammar 700, vocabulary 600, reading 350, listening 300,
   speaking 150, writing 100, pragmatics 200; 8-12 exposures per core concept.
2. **Assessment to beta (600)**: 120 per level; listening/speaking/writing assessment tasks,
   then calibration on pilot responses.
3. **Voice and writing**: STT speaking tasks with typed fallback, TTS listening with transcript
   toggle, writing player with rubric and one focus point.
4. **Real-life scenarios and can-do**: 60 scenarios and 280 can-do statements, each mapped to
   at least three evidence types; add scenario/can-do coverage to the gate.
5. **Content operations**: immutable content packs with checksum/version/rollback, 10% human
   review, item difficulty calibration and retirement of extreme items.

## 8. Metrics

- Coverage: items per level/skill/concept/can-do, audio coverage, assessment balance.
- Learning: first-attempt success, 7-day retention, can-do mastery, error recurrence.
- Experience: session completion, time-to-first-success, hint use, skip/abandon rate.
- Quality: schema-valid AI output, human approval rate, correction precision, level fit.

## Sources

- Council of Europe, CEFR level descriptions.
- Cambridge English, CEFR overview.
- Retrieval Practice (Pooja K. Agarwal), "What is retrieval practice?".
- The Learning Scientists, retrieval practice.
- FSRS algorithm documentation.
- Krashen, comprehensible input.
- Self-Determination Theory.
