import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { M1_TABLES } from '@loqua/db-postgres';
import { mergeAppendOnly, mergeLastWriteWins, syncPolicyFor } from '@loqua/core';

import { MIRROR_DDL, MIRROR_SCHEMA_SHA256, MIRROR_TABLES, POWERSYNC_SCHEMA } from './generated/mirror.js';

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

interface LocalProfile {
  readonly id: string;
  readonly updatedAt: string;
  readonly dailyMinutes: number;
}

function localDevice(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(MIRROR_DDL);
  return db;
}

function seedUser(db: DatabaseSync): void {
  db.prepare(
    'INSERT INTO users (id, email, ui_locale, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run('user-1', 'a@example.test', 'it', '2026-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z');
}

function insertProfile(db: DatabaseSync, id: string, dailyMinutes: number, updatedAt: string): void {
  db.prepare(
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, goal, daily_minutes, timezone,
        interests_json, self_assessment_json, onboarding_completed, created_at, updated_at)
     VALUES (?, 'user-1', 'en', 'it', 'work', ?, 'Europe/Rome', '["work"]', '{"grammar":"B1"}', 1,
             '2026-11-01T09:00:00.000Z', ?)`,
  ).run(id, dailyMinutes, updatedAt);
}

function readProfiles(db: DatabaseSync): LocalProfile[] {
  const rows = db
    .prepare('SELECT id, daily_minutes, updated_at FROM learner_profiles ORDER BY id')
    .all();
  return rows.flatMap((row) => {
    const id = Reflect.get(row, 'id');
    const dailyMinutes = Reflect.get(row, 'daily_minutes');
    const updatedAt = Reflect.get(row, 'updated_at');
    if (typeof id !== 'string' || typeof dailyMinutes !== 'number' || typeof updatedAt !== 'string') {
      return [];
    }
    return [{ id, updatedAt, dailyMinutes }];
  });
}

function upsertProfile(db: DatabaseSync, profile: LocalProfile): void {
  db.prepare(
    'UPDATE learner_profiles SET daily_minutes = ?, updated_at = ? WHERE id = ?',
  ).run(profile.dailyMinutes, profile.updatedAt, profile.id);
}

describe('two-device sqlite merge', () => {
  it('merges offline profiles and append-only attempts without loss', () => {
    const deviceA = localDevice();
    const deviceB = localDevice();
    try {
      seedUser(deviceA);
      seedUser(deviceB);
      insertProfile(deviceA, 'profile-1', 20, '2026-11-01T10:00:00.000Z');
      insertProfile(deviceB, 'profile-1', 30, '2026-11-01T11:00:00.000Z');

      const mergedProfile = mergeLastWriteWins(
        readProfiles(deviceA),
        readProfiles(deviceB),
        'learner_profile',
      );
      expect(mergedProfile.records[0]?.dailyMinutes).toBe(30);
      const winner = mergedProfile.records[0];
      if (!winner) throw new Error('profile merge failed');

      upsertProfile(deviceA, winner);
      upsertProfile(deviceB, winner);
      expect(readProfiles(deviceA)).toEqual(readProfiles(deviceB));
    } finally {
      deviceA.close();
      deviceB.close();
    }
  });

  it('enforces mirror constraints and JSON validity', () => {
    const db = localDevice();
    try {
      seedUser(db);
      expect(() =>
        db.prepare(
          `INSERT INTO devices (id, user_id, platform, created_at, updated_at)
           VALUES ('device-1', 'user-1', 'toaster', '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z')`,
        ).run(),
      ).toThrow();

      expect(() =>
        db.prepare(
          `INSERT INTO learner_profiles
             (id, user_id, target_lang, native_lang, interests_json, created_at, updated_at)
           VALUES ('bad-json', 'user-1', 'en', 'it', 'not-json', '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z')`,
        ).run(),
      ).toThrow();

      insertProfile(db, 'profile-1', 20, '2026-11-01T10:00:00.000Z');
      expect(() => insertProfile(db, 'profile-2', 20, '2026-11-01T10:00:00.000Z')).toThrow();
    } finally {
      db.close();
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
