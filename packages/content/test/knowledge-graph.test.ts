import { describe, expect, it } from 'vitest';

import { CEFR_LEVELS, cefrRank, type SkillDomain } from '@loqua/core';

import {
  CONCEPTS,
  CONCEPT_EDGES,
  CONCEPT_PREREQUISITE_WEIGHT,
  getConcept,
  getConceptsForLevel,
  getPrerequisites,
  isConceptUnlocked,
} from '../src/knowledge-graph.js';

const DOMAIN_PREFIX: Record<SkillDomain, string> = {
  grammar: 'en.gram.',
  vocabulary: 'en.vocab.',
  listening: 'en.list.',
  speaking: 'en.speak.',
  reading: 'en.read.',
  writing: 'en.write.',
  pragmatics: 'en.prag.',
};

function assertAcyclic(): void {
  const adjacency = new Map<string, string[]>();
  for (const concept of CONCEPTS) adjacency.set(concept.id, []);
  for (const edge of CONCEPT_EDGES) {
    const targets = adjacency.get(edge.from);
    if (targets) targets.push(edge.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (conceptId: string): void => {
    if (visiting.has(conceptId)) throw new Error(`cycle detected at ${conceptId}`);
    if (visited.has(conceptId)) return;
    visiting.add(conceptId);
    for (const next of adjacency.get(conceptId) ?? []) visit(next);
    visiting.delete(conceptId);
    visited.add(conceptId);
  };

  for (const concept of CONCEPTS) visit(concept.id);
}

describe('knowledge graph integrity', () => {
  it('has at least 35 A1-C1 concepts', () => {
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(35);
  });

  it('has unique namespaced concept ids that match the domain', () => {
    const ids = new Set<string>();

    for (const concept of CONCEPTS) {
      expect(ids.has(concept.id)).toBe(false);
      ids.add(concept.id);
      expect(concept.id.startsWith(DOMAIN_PREFIX[concept.domain])).toBe(true);
      expect(CEFR_LEVELS).toContain(concept.level);
    }
  });

  it('only references existing concepts in edges with weights between 0 and 1', () => {
    const ids = new Set(CONCEPTS.map((concept) => concept.id));

    for (const edge of CONCEPT_EDGES) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(edge.weight).toBeGreaterThanOrEqual(0);
      expect(edge.weight).toBeLessThanOrEqual(1);
    }
  });

  it('is acyclic', () => {
    expect(() => assertAcyclic()).not.toThrow();
  });

  it('only uses same-or-lower level prerequisites for strong edges', () => {
    const byId = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

    for (const edge of CONCEPT_EDGES) {
      if (edge.weight < CONCEPT_PREREQUISITE_WEIGHT) continue;
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      if (!from || !to) continue;
      expect(cefrRank(from.level)).toBeLessThanOrEqual(cefrRank(to.level));
    }
  });
});

describe('knowledge graph helpers', () => {
  it('looks up concepts by id', () => {
    expect(getConcept('en.gram.tense.present_perfect_form')?.domain).toBe('grammar');
    expect(getConcept('en.missing.concept')).toBeUndefined();
  });

  it('returns concepts for every CEFR level', () => {
    for (const level of CEFR_LEVELS) {
      const concepts = getConceptsForLevel(level);
      expect(concepts.length).toBeGreaterThan(0);
      expect(concepts.every((concept) => concept.level === level)).toBe(true);
    }
  });

  it('returns incoming prerequisite edges', () => {
    const prerequisites = getPrerequisites('en.gram.tense.present_perfect_experience');
    expect(prerequisites).toContainEqual({
      from: 'en.gram.tense.present_perfect_form',
      to: 'en.gram.tense.present_perfect_experience',
      weight: 0.8,
    });
  });

  it('treats concepts without strong prerequisites as unlocked', () => {
    expect(isConceptUnlocked('en.gram.tense.present_simple', {})).toBe(true);
    expect(isConceptUnlocked('en.missing.concept', {})).toBe(false);
  });

  it('keeps a concept locked until strong prerequisites reach the threshold', () => {
    const conceptId = 'en.gram.tense.present_perfect_experience';
    expect(isConceptUnlocked(conceptId, {})).toBe(false);
    expect(isConceptUnlocked(conceptId, { 'en.gram.tense.present_perfect_form': 0.49 })).toBe(
      false,
    );
    expect(isConceptUnlocked(conceptId, { 'en.gram.tense.present_perfect_form': 0.5 })).toBe(true);
  });

  it('ignores weak prerequisites and honours a custom threshold', () => {
    const conceptId = 'en.gram.inversion.negative';
    expect(isConceptUnlocked(conceptId, { 'en.gram.conditional.second': 0.5 }, 0.5)).toBe(true);
    expect(isConceptUnlocked(conceptId, { 'en.gram.conditional.second': 0.4 }, 0.5)).toBe(false);
  });
});
