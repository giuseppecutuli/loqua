import { canonicalize } from './export.js';

export const SYNC_ENTITIES = [
  'learner_profile',
  'settings',
  'consent',
  'device',
  'session',
  'attempt',
  'srs_review',
  'error_event',
  'xp_event',
  'activity_day',
  'saved_phrase',
  'content_request',
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export type SyncPolicy = 'append_only' | 'last_write_wins' | 'content_read_only' | 'server_only';

const POLICIES: Record<SyncEntity, SyncPolicy> = {
  learner_profile: 'last_write_wins',
  settings: 'last_write_wins',
  consent: 'last_write_wins',
  device: 'last_write_wins',
  session: 'last_write_wins',
  attempt: 'append_only',
  srs_review: 'append_only',
  error_event: 'append_only',
  xp_event: 'append_only',
  activity_day: 'server_only',
  saved_phrase: 'last_write_wins',
  content_request: 'server_only',
};

export function syncPolicyFor(entity: SyncEntity): SyncPolicy {
  return POLICIES[entity];
}

export interface VersionedRecord {
  readonly id: string;
  readonly updatedAt: string;
  readonly deletedAt?: string | null;
}

export interface SyncConflict {
  readonly entity: SyncEntity;
  readonly entityId: string;
  readonly resolution: 'local' | 'remote' | 'merged';
  readonly detail: Record<string, unknown>;
}

export function mergeAppendOnly<T extends { readonly id: string }>(
  local: readonly T[],
  remote: readonly T[],
): readonly T[] {
  const merged = new Map<string, T>();
  for (const record of local) merged.set(record.id, record);
  for (const record of remote) merged.set(record.id, record);
  return [...merged.values()];
}

export function resolveLastWriteWins<T extends VersionedRecord>(
  local: T,
  remote: T,
  entity: SyncEntity = 'learner_profile',
): { readonly value: T; readonly conflict: SyncConflict } {
  if (local.id !== remote.id) {
    throw new Error('Cannot resolve records with different ids');
  }

  if (remote.updatedAt > local.updatedAt) {
    return {
      value: remote,
      conflict: {
        entity,
        entityId: local.id,
        resolution: 'remote',
        detail: { localUpdatedAt: local.updatedAt, remoteUpdatedAt: remote.updatedAt },
      },
    };
  }

  if (local.updatedAt > remote.updatedAt) {
    return {
      value: local,
      conflict: {
        entity,
        entityId: local.id,
        resolution: 'local',
        detail: { localUpdatedAt: local.updatedAt, remoteUpdatedAt: remote.updatedAt },
      },
    };
  }

  const localKey = canonicalize(local);
  const remoteKey = canonicalize(remote);
  const chooseRemote = remoteKey > localKey;
  return {
    value: chooseRemote ? remote : local,
    conflict: {
      entity,
      entityId: local.id,
      resolution: chooseRemote ? 'remote' : 'local',
      detail: { tieBreaker: 'canonical_lexicographic' },
    },
  };
}

export function mergeLastWriteWins<T extends VersionedRecord>(
  local: readonly T[],
  remote: readonly T[],
  entity: SyncEntity = 'learner_profile',
): { readonly records: readonly T[]; readonly conflicts: readonly SyncConflict[] } {
  const merged = new Map<string, T>();
  const conflicts: SyncConflict[] = [];

  for (const record of local) merged.set(record.id, record);
  for (const record of remote) {
    const existing = merged.get(record.id);
    if (!existing) {
      merged.set(record.id, record);
      continue;
    }
    const resolved = resolveLastWriteWins(existing, record, entity);
    merged.set(record.id, resolved.value);
    conflicts.push(resolved.conflict);
  }

  return { records: [...merged.values()], conflicts };
}

export function mergeServerOnly<T extends { readonly id: string }>(
  local: readonly T[],
  remote: readonly T[],
): readonly T[] {
  void local;
  return [...remote];
}

export function mergeRecords<T extends { readonly id: string } & Partial<VersionedRecord>>(
  entity: SyncEntity,
  local: readonly T[],
  remote: readonly T[],
): { readonly records: readonly T[]; readonly conflicts: readonly SyncConflict[] } {
  const policy = syncPolicyFor(entity);
  switch (policy) {
    case 'append_only':
      return { records: mergeAppendOnly(local, remote), conflicts: [] };
    case 'content_read_only':
    case 'server_only':
      return { records: mergeServerOnly(local, remote), conflicts: [] };
    case 'last_write_wins': {
      const withVersion = (records: readonly T[]): readonly (T & VersionedRecord)[] =>
        records.map((record) => ({
          ...record,
          updatedAt: record.updatedAt ?? '1970-01-01T00:00:00.000Z',
        }));
      const result = mergeLastWriteWins(withVersion(local), withVersion(remote));
      return {
        records: result.records,
        conflicts: result.conflicts.map((conflict) => ({ ...conflict, entity })),
      };
    }
  }
}
