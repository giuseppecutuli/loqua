import { describe, expect, it } from 'vitest';

import { isIanaTimezone, isUtcIso, localDayKey, toUtcIso } from '../src/dates.js';

describe('dates', () => {
  it('validates UTC ISO-8601 timestamps', () => {
    expect(isUtcIso('2026-11-01T10:00:00.000Z')).toBe(true);
    expect(isUtcIso('2026-11-01T10:00:00Z')).toBe(false);
    expect(isUtcIso('not-a-date')).toBe(false);
    expect(toUtcIso(new Date('2026-11-01T10:00:00.000Z'))).toBe('2026-11-01T10:00:00.000Z');
  });

  it('validates IANA timezones', () => {
    expect(isIanaTimezone('Europe/Rome')).toBe(true);
    expect(isIanaTimezone('Mars/Olympus')).toBe(false);
  });

  it('computes local day keys from a timezone', () => {
    const instant = new Date('2026-11-01T23:30:00.000Z');
    expect(localDayKey(instant, 'Europe/Rome')).toBe('2026-11-02');
    expect(localDayKey(instant, 'UTC')).toBe('2026-11-01');
  });
});
