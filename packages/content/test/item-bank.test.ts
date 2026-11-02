import { describe, expect, it } from 'vitest';

import { CONCEPTS } from '../src/knowledge-graph.js';
import { validateFoundationItems, type FoundationItem } from '../src/item-bank.js';

const concept = CONCEPTS.find((entry) => entry.domain === 'grammar');
if (!concept) throw new Error('grammar concept fixture missing');

function item(overrides: Partial<FoundationItem> = {}): FoundationItem {
  return {
    id: 'test.item.1',
    conceptId: concept.id,
    skill: concept.domain,
    cefrLevel: concept.level,
    type: 'cloze',
    prompt: 'She ___ to work every day.',
    options: [
      { id: 'a', text: 'goes' },
      { id: 'b', text: 'go' },
    ],
    correctOptionId: 'a',
    explanation: 'Third person singular takes -s.',
    difficultyB: 0,
    topic: 'work',
    register: 'neutral',
    tags: ['test'],
    ...overrides,
  };
}

describe('foundation item validation', () => {
  it('accepts a well-formed item', () => {
    expect(validateFoundationItems([item()])).toEqual([]);
  });

  it('rejects duplicate ids and prompts', () => {
    const errors = validateFoundationItems([item(), item({ id: 'test.item.1' })]);
    expect(errors.some((error) => error.includes('duplicate item id'))).toBe(true);
    expect(errors.some((error) => error.includes('duplicate prompt'))).toBe(true);
  });

  it('rejects unknown concepts, wrong skills, and bad answers', () => {
    const errors = validateFoundationItems([
      item({ id: 'bad.1', conceptId: 'en.missing', correctOptionId: 'z' }),
      item({ id: 'bad.2', skill: 'vocabulary' }),
    ]);
    expect(errors.some((error) => error.includes('unknown concept'))).toBe(true);
    expect(errors.some((error) => error.includes('correctOptionId'))).toBe(true);
    expect(errors.some((error) => error.includes('does not match concept domain'))).toBe(true);
  });
});
