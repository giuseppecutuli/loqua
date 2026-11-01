import { isUtcIso } from './dates.js';

export const CONSENT_KINDS = [
  'terms',
  'privacy',
  'voice',
  'ai_processing',
  'analytics',
] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const REQUIRED_CONSENTS: readonly ConsentKind[] = ['terms', 'privacy'];

export interface ConsentRecord {
  readonly id: string;
  readonly userId: string;
  readonly kind: ConsentKind;
  readonly version: string;
  readonly grantedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

export interface ConsentGrant {
  readonly id: string;
  readonly userId: string;
  readonly kind: ConsentKind;
  readonly version: string;
  readonly now: Date;
}

export function isConsentKind(value: unknown): value is ConsentKind {
  return typeof value === 'string' && (CONSENT_KINDS as readonly string[]).includes(value);
}

function isActive(record: ConsentRecord): boolean {
  return record.grantedAt !== null && record.revokedAt === null;
}

export function grantConsent(
  records: readonly ConsentRecord[],
  grant: ConsentGrant,
): readonly ConsentRecord[] {
  if (!isConsentKind(grant.kind)) throw new Error(`Unknown consent kind: ${String(grant.kind)}`);
  const grantedAt = grant.now.toISOString();
  const existing = records.find(
    (record) =>
      record.userId === grant.userId &&
      record.kind === grant.kind &&
      record.version === grant.version,
  );

  if (existing) {
    return records.map((record) =>
      record.id === existing.id
        ? { ...record, grantedAt, revokedAt: null }
        : record,
    );
  }

  return [
    ...records,
    {
      id: grant.id,
      userId: grant.userId,
      kind: grant.kind,
      version: grant.version,
      grantedAt,
      revokedAt: null,
      createdAt: grantedAt,
    },
  ];
}

export function revokeConsent(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
  version: string,
  now: Date,
): readonly ConsentRecord[] {
  const revokedAt = now.toISOString();
  return records.map((record) =>
    record.kind === kind && record.version === version && record.revokedAt === null
      ? { ...record, revokedAt }
      : record,
  );
}

export function activeConsents(records: readonly ConsentRecord[]): readonly ConsentRecord[] {
  return records.filter(isActive);
}

export function hasActiveConsent(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
  version?: string,
): boolean {
  return records.some(
    (record) =>
      isActive(record) &&
      record.kind === kind &&
      (version === undefined || record.version === version),
  );
}

export function missingConsents(
  records: readonly ConsentRecord[],
  required: readonly ConsentKind[] = REQUIRED_CONSENTS,
): readonly ConsentKind[] {
  return required.filter((kind) => !hasActiveConsent(records, kind));
}

export function canProcessAi(records: readonly ConsentRecord[]): boolean {
  return (
    missingConsents(records, ['terms', 'privacy', 'ai_processing']).length === 0
  );
}

export function canUseVoice(records: readonly ConsentRecord[]): boolean {
  return canProcessAi(records) && hasActiveConsent(records, 'voice');
}

export function validateConsentRecord(record: ConsentRecord): readonly string[] {
  const errors: string[] = [];
  if (!isConsentKind(record.kind)) errors.push('kind_invalid');
  if (record.version.trim().length === 0) errors.push('version_invalid');
  if (!isUtcIso(record.createdAt)) errors.push('created_at_invalid');
  if (record.grantedAt !== null && !isUtcIso(record.grantedAt)) errors.push('granted_at_invalid');
  if (record.revokedAt !== null && !isUtcIso(record.revokedAt)) errors.push('revoked_at_invalid');
  if (record.grantedAt !== null && record.revokedAt !== null && record.revokedAt < record.grantedAt) {
    errors.push('revoked_before_granted');
  }
  return errors;
}
