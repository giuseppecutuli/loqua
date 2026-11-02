import { describe, expect, it } from 'vitest';

import {
  ERROR_DRILL_THRESHOLD,
  ERROR_WINDOW_DAYS,
  selectDrillItem,
  shouldTriggerErrorDrill,
} from '../src/error-bank.js';

describe('error drills', () => {
  it('triggers on the third occurrence in the window', () => {
    expect(ERROR_WINDOW_DAYS).toBe(14);
    expect(shouldTriggerErrorDrill(0)).toBe(false);
    expect(shouldTriggerErrorDrill(1)).toBe(false);
    expect(shouldTriggerErrorDrill(ERROR_DRILL_THRESHOLD - 1)).toBe(true);
    expect(shouldTriggerErrorDrill(5)).toBe(true);
  });

  it('picks a deterministic same-skill item that is not already used', () => {
    const candidates = [
      { itemId: 'b', skill: 'grammar' as const },
      { itemId: 'a', skill: 'grammar' as const },
      { itemId: 'c', skill: 'vocabulary' as const },
    ];
    expect(selectDrillItem(candidates, new Set(), 'z', 'grammar')?.itemId).toBe('a');
    expect(selectDrillItem(candidates, new Set(['a']), 'z', 'grammar')?.itemId).toBe('b');
    expect(selectDrillItem(candidates, new Set(['a', 'b']), 'z', 'grammar')).toBeNull();
  });

  it('never selects the attempted item or another skill', () => {
    const candidates = [
      { itemId: 'a', skill: 'grammar' as const },
      { itemId: 'b', skill: 'vocabulary' as const },
    ];
    expect(selectDrillItem(candidates, new Set(), 'a', 'grammar')).toBeNull();
    expect(selectDrillItem(candidates, new Set(), 'z', 'reading')).toBeNull();
  });
});
