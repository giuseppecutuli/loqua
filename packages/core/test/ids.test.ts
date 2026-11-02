import { describe, expect, it } from 'vitest';

import { generateUuidV7, isUuidV7 } from '../src/ids.js';

describe('uuid v7', () => {
  it('generates valid v7 identifiers', () => {
    const id = generateUuidV7(1_700_000_000_000);
    expect(isUuidV7(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('is time-sortable', () => {
    const earlier = generateUuidV7(1_700_000_000_000);
    const later = generateUuidV7(1_700_000_001_000);
    expect(later > earlier).toBe(true);
  });

  it('rejects negative timestamps', () => {
    expect(() => generateUuidV7(-1)).toThrow(RangeError);
  });
});
