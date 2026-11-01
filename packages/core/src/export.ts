import type { ConsentRecord } from './consent.js';
import { isUtcIso } from './dates.js';
import type { Device } from './devices.js';
import type { LearnerProfile } from './profile.js';
import type { Result } from './result.js';

export const EXPORT_FORMAT_VERSION = 1;
export const SUPPORTED_EXPORT_FORMAT_VERSIONS: readonly number[] = [EXPORT_FORMAT_VERSION];
export const EXPORT_SCHEMA_VERSION = 'm1';

export interface ExportSettings {
  readonly desiredRetention: number;
  readonly aiDailyBudgetUsd: number;
  readonly modelPrefs: Record<string, unknown>;
  readonly notificationPrefs: Record<string, unknown>;
}

export interface ExportPayload {
  readonly formatVersion: number;
  readonly schemaVersion: string;
  readonly exportedAt: string;
  readonly userId: string;
  readonly profile: LearnerProfile | null;
  readonly consents: readonly ConsentRecord[];
  readonly devices: readonly Device[];
  readonly settings: ExportSettings | null;
  readonly data: Record<string, unknown>;
}

export interface ExportEnvelope extends ExportPayload {
  readonly checksum: string;
}

export type ExportErrorCode =
  | 'invalid_json'
  | 'invalid_payload'
  | 'unknown_format_version'
  | 'checksum_mismatch'
  | 'invalid_checksum';

export interface ExportError {
  readonly code: ExportErrorCode;
  readonly message: string;
}

export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries: string[] = [];
    for (const key of keys) {
      const entry = record[key];
      if (entry === undefined) continue;
      entries.push(`${JSON.stringify(key)}:${canonicalize(entry)}`);
    }
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function exportChecksumInput(payload: ExportPayload): string {
  return canonicalize(payload);
}

export async function createExportEnvelope(payload: ExportPayload): Promise<ExportEnvelope> {
  const checksum = await sha256Hex(exportChecksumInput(payload));
  return { ...payload, checksum };
}

export function serializeExport(envelope: ExportEnvelope): string {
  return canonicalize(envelope);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function parseExportJson(
  text: string,
): Promise<Result<ExportEnvelope, ExportError>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'invalid_json', message: 'Export is not valid JSON' } };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: { code: 'invalid_payload', message: 'Export must be an object' } };
  }

  const formatVersion = parsed.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion)) {
    return {
      ok: false,
      error: { code: 'invalid_payload', message: 'formatVersion must be an integer' },
    };
  }

  if (!SUPPORTED_EXPORT_FORMAT_VERSIONS.includes(formatVersion)) {
    return {
      ok: false,
      error: {
        code: 'unknown_format_version',
        message: `Unsupported export format version ${formatVersion}`,
      },
    };
  }

  const checksum = parsed.checksum;
  if (typeof checksum !== 'string' || !/^[0-9a-f]{64}$/.test(checksum)) {
    return {
      ok: false,
      error: { code: 'invalid_checksum', message: 'checksum must be a SHA-256 hex digest' },
    };
  }

  if (typeof parsed.userId !== 'string' || !isUtcIso(parsed.exportedAt)) {
    return {
      ok: false,
      error: { code: 'invalid_payload', message: 'userId and exportedAt are required' },
    };
  }

  if (typeof parsed.schemaVersion !== 'string') {
    return {
      ok: false,
      error: { code: 'invalid_payload', message: 'schemaVersion is required' },
    };
  }

  if (
    !Array.isArray(parsed.consents) ||
    !Array.isArray(parsed.devices) ||
    !isRecord(parsed.data) ||
    !(parsed.profile === null || isRecord(parsed.profile)) ||
    !(parsed.settings === null || isRecord(parsed.settings))
  ) {
    return {
      ok: false,
      error: { code: 'invalid_payload', message: 'Export sections are malformed' },
    };
  }

  const { checksum: _checksum, ...rest } = parsed;
  const payload = rest as unknown as ExportPayload;
  const expected = await sha256Hex(exportChecksumInput(payload));
  if (expected !== checksum) {
    return {
      ok: false,
      error: { code: 'checksum_mismatch', message: 'Export checksum does not match' },
    };
  }

  return { ok: true, value: { ...payload, checksum } };
}
