import { describe, expect, it } from 'vitest';

import { CEFR_LEVELS } from '@loqua/core';

import {
  RULES,
  RULE_CATEGORIES,
  RULE_CATEGORY_PREFIX,
  getRule,
  getRulesForCategory,
  getRulesForLevel,
  isRuleIdForCategory,
  isValidRuleId,
} from '../src/rule-bank.js';

describe('rule bank', () => {
  it('has at least 25 rules with unique ids', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(25);

    const ids = new Set<string>();
    for (const rule of RULES) {
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
    }
  });

  it('namespaces every rule id by its category', () => {
    for (const rule of RULES) {
      expect(RULE_CATEGORIES).toContain(rule.category);
      expect(rule.id.startsWith(RULE_CATEGORY_PREFIX[rule.category])).toBe(true);
      expect(isRuleIdForCategory(rule.id, rule.category)).toBe(true);
      expect(isValidRuleId(rule.id)).toBe(true);
    }
  });

  it('rejects rule ids that do not match a known namespace', () => {
    expect(isValidRuleId('present_perfect')).toBe(false);
    expect(isValidRuleId('de.gram.tense.present_perfect')).toBe(false);
    expect(isRuleIdForCategory('en.lex.false_friend.actually', 'grammar')).toBe(false);
  });

  it('has a CEFR level, explanation, and two distinct examples per rule', () => {
    for (const rule of RULES) {
      expect(CEFR_LEVELS).toContain(rule.level);
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.targetExplanation.length).toBeGreaterThan(0);
      expect(rule.examples.length).toBeGreaterThanOrEqual(2);

      for (const example of rule.examples) {
        expect(example.incorrect.length).toBeGreaterThan(0);
        expect(example.correct.length).toBeGreaterThan(0);
        expect(example.incorrect).not.toBe(example.correct);
      }
    }
  });

  it('includes common Italian to English transfer rules', () => {
    const transferRules = RULES.filter((rule) => rule.l1Transfer?.nativeLang === 'it');

    expect(transferRules.length).toBeGreaterThanOrEqual(5);
    for (const rule of transferRules) {
      expect(rule.l1Transfer?.pattern.length).toBeGreaterThan(0);
      expect(rule.l1Transfer?.note.length).toBeGreaterThan(0);
    }
  });

  it('looks up rules by id, level, and category', () => {
    expect(getRule('en.gram.tense.present_perfect')?.level).toBe('A2');
    expect(getRule('en.missing.rule')).toBeUndefined();
    expect(getRulesForLevel('C1').every((rule) => rule.level === 'C1')).toBe(true);
    expect(getRulesForCategory('lexis').every((rule) => rule.category === 'lexis')).toBe(true);
  });
});
