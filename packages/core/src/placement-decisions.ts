import { z } from 'zod';

import type { PlacementResult, PlacementState } from './assessment.js';
import { cefrLevelSchema, skillDomainSchema } from './schemas.js';
import { cefrRank, nextCefrLevel, type CefrLevel, type SkillDomain } from './skills.js';

export const CONCEPT_MASTERY_THRESHOLD = 0.85;
export const MIN_CONCEPT_EVIDENCE = 2;
export const REMEDIATION_MIN_GAP = 1;
export const CHALLENGE_MIN_CONFIDENCE = 0.6;

export interface ConceptEvidence {
  readonly conceptId: string;
  readonly skill: SkillDomain;
  readonly nObs: number;
  readonly correct: number;
  readonly mastery: number;
}

export interface RemediationSkill {
  readonly skill: SkillDomain;
  readonly level: CefrLevel;
  readonly gap: number;
  readonly concepts: readonly ConceptEvidence[];
}

export const conceptEvidenceSchema = z.object({
  conceptId: z.string().min(1),
  skill: skillDomainSchema,
  nObs: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  mastery: z.number().min(0).max(1),
});

export const remediationSkillSchema = z.object({
  skill: skillDomainSchema,
  level: cefrLevelSchema,
  gap: z.number().int().positive(),
  concepts: z.array(conceptEvidenceSchema),
});

export const placementDecisionsSchema = z.object({
  testOutConcepts: z.array(conceptEvidenceSchema),
  remediationSkills: z.array(remediationSkillSchema),
  challengeLevel: cefrLevelSchema.nullable(),
});

export interface PlacementDecisions {
  readonly testOutConcepts: readonly ConceptEvidence[];
  readonly remediationSkills: readonly RemediationSkill[];
  readonly challengeLevel: CefrLevel | null;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function aggregateConceptEvidence(state: PlacementState): readonly ConceptEvidence[] {
  const byConcept = new Map<string, { skill: SkillDomain; nObs: number; correct: number }>();
  for (const response of state.responses) {
    const current = byConcept.get(response.conceptId) ?? {
      skill: response.skill,
      nObs: 0,
      correct: 0,
    };
    byConcept.set(response.conceptId, {
      skill: current.skill,
      nObs: current.nObs + 1,
      correct: current.correct + (response.correct ? 1 : 0),
    });
  }

  const evidence: ConceptEvidence[] = [];
  for (const [conceptId, entry] of byConcept) {
    let mastery = 0.5;
    for (const response of state.responses) {
      if (response.conceptId !== conceptId) continue;
      const outcome = response.correct ? 1 : 0;
      mastery = mastery + 0.3 * (outcome - mastery);
    }
    evidence.push({
      conceptId,
      skill: entry.skill,
      nObs: entry.nObs,
      correct: entry.correct,
      mastery: round(mastery),
    });
  }
  return evidence.sort((a, b) => a.conceptId.localeCompare(b.conceptId));
}

export function evaluatePlacementDecisions(
  state: PlacementState,
  result: PlacementResult,
): PlacementDecisions {
  const evidence = aggregateConceptEvidence(state);
  const testOutConcepts = evidence.filter(
    (entry) => entry.nObs >= MIN_CONCEPT_EVIDENCE && entry.mastery >= CONCEPT_MASTERY_THRESHOLD,
  );

  const remediationSkills: RemediationSkill[] = [];
  if (result.overallLevel) {
    for (const measured of result.measured) {
      if (!measured.measured || !measured.level) continue;
      const gap = cefrRank(result.overallLevel) - cefrRank(measured.level);
      if (gap < REMEDIATION_MIN_GAP) continue;
      remediationSkills.push({
        skill: measured.skill,
        level: measured.level,
        gap,
        concepts: evidence.filter((entry) => entry.skill === measured.skill && entry.mastery < 0.5),
      });
    }
  }

  const canChallenge =
    result.overallLevel !== null &&
    result.confidence >= CHALLENGE_MIN_CONFIDENCE &&
    remediationSkills.length === 0;
  const challengeLevel =
    canChallenge && result.overallLevel ? nextCefrLevel(result.overallLevel) : null;

  return { testOutConcepts, remediationSkills, challengeLevel };
}
