import { describe, expect, it } from 'vitest';

import {
  canProcessAi,
  canUseVoice,
  grantConsent,
  hasActiveConsent,
  missingConsents,
  reassignConsentOwner,
  revokeConsent,
  type ConsentRecord,
} from '../src/consent.js';

const user = 'user-1';
const now = new Date('2026-11-01T10:00:00.000Z');

function grant(
  records: readonly ConsentRecord[],
  kind: 'terms' | 'privacy' | 'voice' | 'ai_processing' | 'analytics',
  version = '1',
): readonly ConsentRecord[] {
  return grantConsent(records, { id: `consent-${kind}`, userId: user, kind, version, now });
}

describe('consents', () => {
  it('requires terms and privacy before anything else', () => {
    let records: readonly ConsentRecord[] = [];
    expect(missingConsents(records)).toEqual(['terms', 'privacy']);
    records = grant(records, 'terms');
    records = grant(records, 'privacy');
    expect(missingConsents(records)).toEqual([]);
    expect(canProcessAi(records)).toBe(false);
  });

  it('gates AI and voice separately', () => {
    let records: readonly ConsentRecord[] = [];
    for (const kind of ['terms', 'privacy', 'ai_processing'] as const) records = grant(records, kind);
    expect(canProcessAi(records)).toBe(true);
    expect(canUseVoice(records)).toBe(false);
    records = grant(records, 'voice');
    expect(canUseVoice(records)).toBe(true);
  });

  it('revokes a consent', () => {
    const records = grant(grant([], 'terms'), 'privacy');
    const revoked = revokeConsent(records, 'privacy', '1', new Date('2026-11-02T10:00:00.000Z'));
    expect(hasActiveConsent(revoked, 'privacy')).toBe(false);
    expect(missingConsents(revoked)).toEqual(['privacy']);
  });

  it('reassigns consent ownership during anonymous upgrade', () => {
    const [record] = grant([], 'terms');
    if (!record) throw new Error('consent grant failed');
    const reassigned = reassignConsentOwner(record, 'auth-user');
    expect(reassigned.userId).toBe('auth-user');
    expect(hasActiveConsent([reassigned], 'terms')).toBe(true);
  });

  it('re-granting the same version re-activates it', () => {
    const records = grant([], 'terms');
    const revoked = revokeConsent(records, 'terms', '1', new Date('2026-11-02T10:00:00.000Z'));
    const regranted = grant(revoked, 'terms');
    expect(hasActiveConsent(regranted, 'terms')).toBe(true);
    expect(regranted).toHaveLength(1);
  });
});
