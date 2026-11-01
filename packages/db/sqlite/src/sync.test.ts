import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { M1_TABLES } from '@loqua/db-postgres';
import { mergeAppendOnly, mergeLastWriteWins, syncPolicyFor } from '@loqua/core';

import { MIRROR_SCHEMA_SHA256, MIRROR_TABLES, POWERSYNC_SCHEMA } from './generated/mirror.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(path.join(here, 'schema.sql'), 'utf8');

describe('sqlite mirror', () => {
  it('is generated from the committed schema', () => {
    const checksum = createHash('sha256').update(schemaSql).digest('hex');
    expect(MIRROR_SCHEMA_SHA256).toBe(checksum);
  });

  it('covers every M1 postgres table', () => {
    expect([...MIRROR_TABLES].sort()).toEqual([...M1_TABLES].sort());
  });

  it('exposes a PowerSync schema for every mirror table', () => {
    expect(POWERSYNC_SCHEMA.tables.map((table) => table.name).sort()).toEqual(
      [...MIRROR_TABLES].sort(),
    );
    for (const table of POWERSYNC_SCHEMA.tables) {
      expect(table.columns.length).toBeGreaterThan(0);
      expect(table.columns.some((column) => column.name === 'id' || column.name === 'user_id')).toBe(
        true,
      );
    }
  });
});

describe('two-device sync contract', () => {
  it('merges append-only writes by id across devices', () => {
    const deviceA = [
      { id: 'attempt-1', correct: true },
      { id: 'attempt-2', correct: false },
    ];
    const deviceB = [
      { id: 'attempt-2', correct: true },
      { id: 'attempt-3', correct: true },
    ];
    expect(mergeAppendOnly(deviceA, deviceB)).toHaveLength(3);
    expect(syncPolicyFor('attempt')).toBe('append_only');
  });

  it('keeps profile writes last-write-wins and logs the conflict', () => {
    const profileA = {
      id: 'profile-1',
      updatedAt: '2026-11-01T10:00:00.000Z',
      dailyMinutes: 20,
    };
    const profileB = {
      id: 'profile-1',
      updatedAt: '2026-11-01T11:00:00.000Z',
      dailyMinutes: 30,
    };
    const merged = mergeLastWriteWins([profileA], [profileB], 'learner_profile');
    expect(merged.records[0]?.dailyMinutes).toBe(30);
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0]?.resolution).toBe('remote');
  });
});
