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

## 2. Coverage model

A content unit is only "covered" when all of these exist:

- **Level**: A1, A2, B1, B2, C1.
- **Skill**: grammar, vocabulary, reading, listening, speaking, writing, pragmatics.
- **Can-do**: at least one observable statement per level/skill cluster.
- **Concept**: linked to the knowledge graph and prerequisite edges.
- **Evidence**: receptive and productive tasks, not only recognition.
- **Review status**: approved after automated gates and sampled human review.
- **Modality**: text, audio, spoken response, written response where relevant.

### Target sizes

| Bank               | Target |          Current |
| ------------------ | -----: | ---------------: |
| Practice           |    600 |              147 |
| Assessment         |    200 |              200 |
| Listening practice |    100 |                0 |
| Speaking tasks     |     50 |                0 |
| Writing tasks      |     25 | 1 placement task |

### Practice distribution

| Level     | Practice | Assessment |
| --------- | -------: | ---------: |
| A1        |      120 |         40 |
| A2        |      140 |         40 |
| B1        |      160 |         40 |
| B2        |      120 |         40 |
| C1        |       60 |         40 |
| **Total** |  **600** |    **200** |

Minimum depth: **5 practice items per concept** and **1 assessment item per concept**, with at
least 3 item types per level. A concept with one item is a demo, not coverage.

### Skill mix

- Grammar and vocabulary: the largest share, but always in context.
- Reading and listening: graded input, gist + detail + inference.
- Speaking and writing: rubric-scored production, not multiple choice disguised as output.
- Pragmatics: requests, hedging, disagreement, register, implicit meaning.

### Current gaps (2026-11)

- 15 concepts have no items: 5 listening, 5 speaking, 5 writing.
- Practice is 147 items, average 2.41 per covered concept; 18 legacy concepts have one item.
- B2/C1 practice is thin (22/20); reading/pragmatics practice is thin (19/21).
- Assessment bank exists but is text-only and not calibrated.
- All content is approved after automated gates; the 10% human sample is pending.

## 3. Level playbooks

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

1. **Depth batch**: +5 practice items for each B2/C1 text concept, +5 for reading/pragmatics;
   retire or migrate the 18 legacy one-item concepts.
2. **Assessment balance**: +25 A1 and +25 A2 assessment items; add listening/speaking assessment
   tasks with audio/STT.
3. **Voice batch**: listening items with transcripts + TTS; speaking tasks with STT/rubric;
   writing player with rubric.
4. **Can-do batch**: map every can-do to at least three evidence types and add coverage gate.
5. **Calibration**: pilot responses per item, update `difficulty_b`, retire extreme items.

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
