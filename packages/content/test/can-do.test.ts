import { describe, expect, it } from 'vitest';

import { CEFR_LEVELS, SKILL_DOMAINS } from '@loqua/core';

import {
  CAN_DO_STATEMENTS,
  EVIDENCE_TYPES,
  PLACEMENT_BLUEPRINT,
  getCanDoStatement,
  getCanDoStatementsForLevel,
} from '../src/can-do.js';
import { getConcept } from '../src/knowledge-graph.js';

describe('can-do catalog', () => {
  it('has at least 20 unique statements', () => {
    expect(CAN_DO_STATEMENTS.length).toBeGreaterThanOrEqual(20);

    const ids = new Set<string>();
    for (const statement of CAN_DO_STATEMENTS) {
      expect(ids.has(statement.id)).toBe(false);
      ids.add(statement.id);
      expect(statement.id.startsWith('en.can.')).toBe(true);
    }
  });

  it('covers every CEFR level and every skill domain', () => {
    expect(new Set(CAN_DO_STATEMENTS.map((statement) => statement.level))).toEqual(
      new Set(CEFR_LEVELS),
    );
    expect(new Set(CAN_DO_STATEMENTS.map((statement) => statement.skill))).toEqual(
      new Set(SKILL_DOMAINS),
    );
  });

  it('maps every statement to existing concept ids and valid evidence types', () => {
    for (const statement of CAN_DO_STATEMENTS) {
      expect(statement.statement.length).toBeGreaterThan(0);
      expect(statement.conceptIds.length).toBeGreaterThan(0);
      for (const conceptId of statement.conceptIds) {
        expect(getConcept(conceptId), `${statement.id} -> ${conceptId}`).toBeDefined();
      }
      expect(statement.evidenceTypes.length).toBeGreaterThan(0);
      for (const evidenceType of statement.evidenceTypes) {
        expect(EVIDENCE_TYPES).toContain(evidenceType);
      }
    }
  });

  it('looks up statements by id and level', () => {
    expect(getCanDoStatement('en.can.b1.describe_experience')?.level).toBe('B1');
    expect(getCanDoStatement('en.can.missing.statement')).toBeUndefined();
    expect(getCanDoStatementsForLevel('C1').every((statement) => statement.level === 'C1')).toBe(
      true,
    );
  });
});

describe('placement blueprint', () => {
  it('targets 18-24 objective items plus one writing and two speaking tasks', () => {
    expect(PLACEMENT_BLUEPRINT.objectiveItemRange).toEqual({ min: 18, max: 24 });
    expect(PLACEMENT_BLUEPRINT.writingTaskCount).toBe(1);
    expect(PLACEMENT_BLUEPRINT.speakingTaskCount).toBe(2);
  });

  it('sums objective part ranges to the overall objective range', () => {
    const objectiveParts = PLACEMENT_BLUEPRINT.parts.filter((part) => part.kind === 'objective');
    const min = objectiveParts.reduce((total, part) => total + part.itemRange.min, 0);
    const max = objectiveParts.reduce((total, part) => total + part.itemRange.max, 0);

    expect(min).toBe(PLACEMENT_BLUEPRINT.objectiveItemRange.min);
    expect(max).toBe(PLACEMENT_BLUEPRINT.objectiveItemRange.max);
  });

  it('declares the writing and speaking task counts on their parts', () => {
    const writingParts = PLACEMENT_BLUEPRINT.parts.filter((part) => part.kind === 'writing');
    const speakingParts = PLACEMENT_BLUEPRINT.parts.filter((part) => part.kind === 'speaking');
    const writingItems = writingParts.reduce((total, part) => total + part.itemRange.max, 0);
    const speakingItems = speakingParts.reduce((total, part) => total + part.itemRange.max, 0);

    expect(writingItems).toBe(PLACEMENT_BLUEPRINT.writingTaskCount);
    expect(speakingItems).toBe(PLACEMENT_BLUEPRINT.speakingTaskCount);
  });

  it('uses unique parts with valid evidence types and weights summing to one', () => {
    const ids = new Set<string>();
    let totalWeight = 0;

    for (const part of PLACEMENT_BLUEPRINT.parts) {
      expect(ids.has(part.id)).toBe(false);
      ids.add(part.id);
      expect(part.itemRange.min).toBeLessThanOrEqual(part.itemRange.max);
      expect(part.minimumEvidence).toBeLessThanOrEqual(part.itemRange.max);
      expect(part.evidenceTypes.length).toBeGreaterThan(0);
      for (const evidenceType of part.evidenceTypes) {
        expect(EVIDENCE_TYPES).toContain(evidenceType);
      }
      totalWeight += part.weight;
    }

    expect(totalWeight).toBeCloseTo(1, 5);
  });
});
