import { describe, expect, it } from 'vitest';

import {
  mergeAppendOnly,
  mergeLastWriteWins,
  mergeRecords,
  resolveLastWriteWins,
  syncPolicyFor,
  type VersionedRecord,
} from '../src/sync.js';

interface Attempt {
  readonly id: string;
  readonly correct: boolean;
}

interface Profile extends VersionedRecord {
  readonly id: string;
  readonly updatedAt: string;
  readonly dailyMinutes: number;
}

describe('sync policy', () => {
  it('classifies append-only and derived entities', () => {
    expect(syncPolicyFor('attempt')).toBe('append_only');
    expect(syncPolicyFor('srs_review')).toBe('append_only');
    expect(syncPolicyFor('learner_profile')).toBe('last_write_wins');
    expect(syncPolicyFor('activity_day')).toBe('server_only');
  });

  it('merges append-only events by id', () => {
    const local: Attempt[] = [
      { id: 'a', correct: true },
      { id: 'b', correct: false },
    ];
    const remote: Attempt[] = [
      { id: 'b', correct: true },
      { id: 'c', correct: true },
    ];
    expect(mergeAppendOnly(local, remote)).toEqual([
      { id: 'a', correct: true },
      { id: 'b', correct: true },
      { id: 'c', correct: true },
    ]);
  });

  it('resolves last-write-wins by timestamp', () => {
    const local: Profile = { id: 'p', updatedAt: '2026-11-01T10:00:00.000Z', dailyMinutes: 20 };
    const remote: Profile = { id: 'p', updatedAt: '2026-11-01T11:00:00.000Z', dailyMinutes: 30 };
    const result = resolveLastWriteWins(local, remote);
    expect(result.value.dailyMinutes).toBe(30);
    expect(result.conflict.resolution).toBe('remote');
  });

  it('uses a deterministic tie-breaker', () => {
    const left: Profile = { id: 'p', updatedAt: '2026-11-01T10:00:00.000Z', dailyMinutes: 20 };
    const right: Profile = { id: 'p', updatedAt: '2026-11-01T10:00:00.000Z', dailyMinutes: 30 };
    expect(resolveLastWriteWins(left, right).value).toEqual(
      resolveLastWriteWins(right, left).value,
    );
  });

  it('merges lists and logs conflicts', () => {
    const local: Profile[] = [
      { id: 'p1', updatedAt: '2026-11-01T10:00:00.000Z', dailyMinutes: 20 },
    ];
    const remote: Profile[] = [
      { id: 'p1', updatedAt: '2026-11-01T11:00:00.000Z', dailyMinutes: 30 },
      { id: 'p2', updatedAt: '2026-11-01T11:00:00.000Z', dailyMinutes: 15 },
    ];
    const merged = mergeLastWriteWins(local, remote);
    expect(merged.records).toHaveLength(2);
    expect(merged.conflicts).toHaveLength(1);
  });

  it('treats server-only entities as remote authoritative', () => {
    const merged = mergeRecords('activity_day', [{ id: 'd', updatedAt: 'x' }], [
      { id: 'd2', updatedAt: 'y' },
    ]);
    expect(merged.records.map((record) => record.id)).toEqual(['d2']);
  });
});
