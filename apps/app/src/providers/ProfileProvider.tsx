import {
  canProcessAi,
  canUseVoice,
  consentRecordSchema,
  createExportEnvelope,
  createLearnerProfile,
  deviceSchema,
  generateUuidV7,
  grantConsent,
  isOnboardingComplete,
  learnerProfileSchema,
  registerDevice,
  revokeConsent,
  serializeExport,
  updateLearnerProfile,
  validateOnboarding,
  type ConsentKind,
  type ConsentRecord,
  type Device,
  type DevicePlatform,
  type ExportSettings,
  type LearnerProfile,
  type OnboardingInput,
  type ProfileError,
  EXPORT_FORMAT_VERSION,
  EXPORT_SCHEMA_VERSION,
} from '@loqua/core';
import { createTranslator, type Translator } from '@loqua/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { clearLocalData, readJson, storageMode, writeJson, type StorageMode } from '../lib/local-db';
import { getOrCreateDeviceId, loadOrCreateIdentity, type Identity } from '../lib/identity';
import {
  getPendingWrites,
  pendingWritesCount,
  pushConsent,
  pushDevice,
  pushProfile,
} from '../lib/remote';

const PROFILE_KEY = 'profile';
const CONSENTS_KEY = 'consents';
const DEVICE_KEY = 'device';
const CONSENT_VERSION = '1';

export interface SaveResult {
  readonly ok: boolean;
  readonly errors: readonly ProfileError[];
}

interface ProfileContextValue {
  readonly hydrated: boolean;
  readonly identity: Identity | null;
  readonly profile: LearnerProfile | null;
  readonly consents: readonly ConsentRecord[];
  readonly device: Device | null;
  readonly pendingWrites: number;
  readonly storage: StorageMode;
  readonly t: Translator;
  readonly aiAllowed: boolean;
  readonly voiceAllowed: boolean;
  saveOnboarding(input: OnboardingInput): SaveResult;
  updateProfile(
    patch: Parameters<typeof updateLearnerProfile>[1],
  ): SaveResult;
  grant(kind: ConsentKind, version?: string): void;
  grantMany(kinds: readonly ConsentKind[], version?: string): void;
  revoke(kind: ConsentKind, version?: string): void;
  revokeMany(kinds: readonly ConsentKind[], version?: string): void;
  exportJson(): Promise<string>;
  resetLocal(): void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function platform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'desktop';
}

function parseProfile(value: unknown): LearnerProfile | null {
  const parsed = learnerProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseConsents(value: unknown): readonly ConsentRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = consentRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function parseDevice(value: unknown): Device | null {
  const parsed = deviceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const DEFAULT_SETTINGS: ExportSettings = {
  desiredRetention: 0.9,
  aiDailyBudgetUsd: 0.5,
  modelPrefs: {},
  notificationPrefs: {},
};

export function ProfileProvider({ children }: { readonly children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [consents, setConsents] = useState<readonly ConsentRecord[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [storage, setStorage] = useState<StorageMode>('memory');

  const refreshPending = useCallback(() => {
    setPendingWrites(pendingWritesCount());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const nextIdentity = await loadOrCreateIdentity();
      if (cancelled) return;

      const nextProfile = parseProfile(readJson(PROFILE_KEY));
      const nextConsents = parseConsents(readJson(CONSENTS_KEY));
      let nextDevice = parseDevice(readJson(DEVICE_KEY));

      if (!nextDevice) {
        const registration = registerDevice([], {
          id: getOrCreateDeviceId(),
          userId: nextIdentity.userId,
          platform: platform(),
          name: Platform.OS,
          now: new Date(),
        });
        if (registration.ok) {
          nextDevice = registration.value[0] ?? null;
          if (nextDevice) writeJson(DEVICE_KEY, nextDevice);
        }
      }

      setIdentity(nextIdentity);
      setProfile(nextProfile);
      setConsents(nextConsents);
      setDevice(nextDevice);
      setStorage(storageMode());
      setHydrated(true);
      refreshPending();

      if (nextProfile) void pushProfile(nextProfile).then(refreshPending);
      for (const consent of nextConsents) {
        void pushConsent(consent).then(refreshPending);
      }
      if (nextDevice) void pushDevice(nextDevice).then(refreshPending);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [refreshPending]);

  const persistProfile = useCallback(
    (next: LearnerProfile) => {
      writeJson(PROFILE_KEY, next);
      setProfile(next);
      void pushProfile(next).then(refreshPending);
    },
    [refreshPending],
  );

  const saveOnboarding = useCallback(
    (input: OnboardingInput): SaveResult => {
      const validation = validateOnboarding(input);
      if (!validation.ok) return { ok: false, errors: validation.error };
      if (!identity) return { ok: false, errors: [{ code: 'profile_not_found' }] };

      if (profile) {
        const updated = updateLearnerProfile(profile, validation.value, new Date());
        if (!updated.ok) return { ok: false, errors: updated.error };
        persistProfile(updated.value);
        return { ok: true, errors: [] };
      }

      const created = createLearnerProfile(validation.value, {
        id: generateUuidV7(),
        userId: identity.userId,
        now: new Date(),
      });
      if (!created.ok) return { ok: false, errors: created.error };
      persistProfile(created.value);
      return { ok: true, errors: [] };
    },
    [identity, persistProfile, profile],
  );

  const updateProfile = useCallback(
    (patch: Parameters<typeof updateLearnerProfile>[1]): SaveResult => {
      if (!profile) return { ok: false, errors: [{ code: 'profile_not_found' }] };
      const updated = updateLearnerProfile(profile, patch, new Date());
      if (!updated.ok) return { ok: false, errors: updated.error };
      persistProfile(updated.value);
      return { ok: true, errors: [] };
    },
    [persistProfile, profile],
  );

  const grant = useCallback(
    (kind: ConsentKind, version: string = CONSENT_VERSION) => {
      if (!identity) return;
      const next = grantConsent(consents, {
        id: generateUuidV7(),
        userId: identity.userId,
        kind,
        version,
        now: new Date(),
      });
      setConsents(next);
      writeJson(CONSENTS_KEY, next);
      const record = next.find(
        (entry) => entry.kind === kind && entry.version === version,
      );
      if (record) void pushConsent(record).then(refreshPending);
      refreshPending();
    },
    [consents, identity, refreshPending],
  );

  const grantMany = useCallback(
    (kinds: readonly ConsentKind[], version: string = CONSENT_VERSION) => {
      if (!identity) return;
      let next = consents;
      for (const kind of kinds) {
        next = grantConsent(next, {
          id: generateUuidV7(),
          userId: identity.userId,
          kind,
          version,
          now: new Date(),
        });
      }
      setConsents(next);
      writeJson(CONSENTS_KEY, next);
      for (const record of next) {
        if (record.version === version && kinds.includes(record.kind)) {
          void pushConsent(record).then(refreshPending);
        }
      }
      refreshPending();
    },
    [consents, identity, refreshPending],
  );

  const revoke = useCallback(
    (kind: ConsentKind, version: string = CONSENT_VERSION) => {
      const next = revokeConsent(consents, kind, version, new Date());
      setConsents(next);
      writeJson(CONSENTS_KEY, next);
      const record = next.find(
        (entry) => entry.kind === kind && entry.version === version,
      );
      if (record) void pushConsent(record).then(refreshPending);
      refreshPending();
    },
    [consents, refreshPending],
  );

  const revokeMany = useCallback(
    (kinds: readonly ConsentKind[], version: string = CONSENT_VERSION) => {
      if (!identity) return;
      let next = consents;
      for (const kind of kinds) {
        next = revokeConsent(next, kind, version, new Date());
      }
      setConsents(next);
      writeJson(CONSENTS_KEY, next);
      for (const record of next) {
        if (record.version === version && kinds.includes(record.kind)) {
          void pushConsent(record).then(refreshPending);
        }
      }
      refreshPending();
    },
    [consents, identity, refreshPending],
  );

  const exportJson = useCallback(async (): Promise<string> => {
    const envelope = await createExportEnvelope({
      formatVersion: EXPORT_FORMAT_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      userId: identity?.userId ?? '',
      profile,
      consents,
      devices: device ? [device] : [],
      settings: DEFAULT_SETTINGS,
      data: { pendingWrites: getPendingWrites() },
    });
    return serializeExport(envelope);
  }, [consents, device, identity, profile]);

  const resetLocal = useCallback(() => {
    clearLocalData();
    setProfile(null);
    setConsents([]);
    setDevice(null);
    setIdentity(null);
    setPendingWrites(0);
  }, []);

  const t = useMemo(() => createTranslator(profile?.uiLocale ?? 'it'), [profile?.uiLocale]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      hydrated,
      identity,
      profile,
      consents,
      device,
      pendingWrites,
      storage,
      t,
      aiAllowed: canProcessAi(consents),
      voiceAllowed: canUseVoice(consents),
      saveOnboarding,
      updateProfile,
      grant,
      grantMany,
      revoke,
      revokeMany,
      exportJson,
      resetLocal,
    }),
    [
      consents,
      device,
      exportJson,
      grant,
      grantMany,
      hydrated,
      identity,
      pendingWrites,
      profile,
      resetLocal,
      revoke,
      revokeMany,
      saveOnboarding,
      storage,
      t,
      updateProfile,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}

export { isOnboardingComplete };
