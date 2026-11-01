import { describe, expect, it } from 'vitest';

import {
  createExportEnvelope,
  parseExportJson,
  serializeExport,
  type ExportPayload,
} from '../src/export.js';

function payload(): ExportPayload {
  return {
    formatVersion: 1,
    schemaVersion: 'm1',
    exportedAt: '2026-11-01T10:00:00.000Z',
    userId: 'user-1',
    profile: null,
    consents: [],
    devices: [],
    settings: null,
    data: { attempts: [], nested: { b: 2, a: 1 } },
  };
}

describe('export envelope', () => {
  it('serializes deterministically and verifies the checksum', async () => {
    const envelope = await createExportEnvelope(payload());
    const text = serializeExport(envelope);
    expect(text).toBe(serializeExport(envelope));
    expect(text).toContain('"a":1,"b":2');

    const parsed = await parseExportJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.checksum).toBe(envelope.checksum);
  });

  it('rejects tampered payloads', async () => {
    const envelope = await createExportEnvelope(payload());
    const text = serializeExport(envelope).replace('"user-1"', '"user-2"');
    const parsed = await parseExportJson(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('checksum_mismatch');
  });

  it('rejects unknown format versions', async () => {
    const envelope = await createExportEnvelope({ ...payload(), formatVersion: 99 });
    const parsed = await parseExportJson(serializeExport(envelope));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.code).toBe('unknown_format_version');
  });

  it('rejects invalid json and invalid checksums', async () => {
    const invalidJson = await parseExportJson('{nope');
    expect(invalidJson.ok).toBe(false);

    const envelope = await createExportEnvelope(payload());
    const invalidChecksum = await parseExportJson(
      serializeExport({ ...envelope, checksum: 'not-a-checksum' }),
    );
    expect(invalidChecksum.ok).toBe(false);
    if (!invalidChecksum.ok) expect(invalidChecksum.error.code).toBe('invalid_checksum');
  });
});
