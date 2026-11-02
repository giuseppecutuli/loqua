import {
  canProcessAi,
  canUseVoice,
  createLearnerProfile,
  generateUuidV7,
  grantConsent,
  isOnboardingComplete,
  revokeConsent,
  updateLearnerProfile,
  validateOnboarding,
  type ConsentKind,
  type ConsentRecord,
  type Device,
  type DevicePlatform,
  type LearnerProfile,
  type OnboardingInput,
  type ProfileError,
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

import {
  fetchConsents,
  fetchProfile,
  fetchServerExport,
  registerDevice,
  saveConsents,
  saveProfile,
} from '../lib/api';
import { getOrCreateDeviceId, loadOrCreateIdentity, type Identity } from '../lib/identity';
import { supabase } from '../lib/supabase';

const CONSENT_VERSION = '1';

export interface SaveResult {
  readonly ok: boolean;
  readonly errors: readonly ProfileError[];
}

interface ProfileContextValue {
  readonly hydrated: boolean;
  readonly authError: boolean;
  readonly identity: Identity | null;
  readonly profile: LearnerProfile | null;
  readonly consents: readonly ConsentRecord[];
  readonly device: Device | null;
  readonly t: Translator;
  readonly aiAllowed: boolean;
  readonly voiceAllowed: boolean;
  saveOnboarding(input: OnboardingInput): Promise<SaveResult>;
  updateProfile(patch: Parameters<typeof updateLearnerProfile>[1]): Promise<SaveResult>;
  grant(kind: ConsentKind, version?: string): Promise<void>;
  grantMany(kinds: readonly ConsentKind[], version?: string): Promise<void>;
  revoke(kind: ConsentKind, version?: string): Promise<void>;
  revokeMany(kinds: readonly ConsentKind[], version?: string): Promise<void>;
  exportJson(): Promise<string>;
  resetLocal(): Promise<void>;
  retry(): void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function platform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'desktop';
}

export function ProfileProvider({ children }: { readonly children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [consents, setConsents] = useState<readonly ConsentRecord[]>([]);
  const [device, setDevice] = useState<Device | null>(null);

  const hydrate = useCallback(async () => {
    setAuthError(false);
    try {
      const nextIdentity = await loadOrCreateIdentity();
      const [nextProfile, nextConsents] = await Promise.all([fetchProfile(), fetchConsents()]);

      let nextDevice: Device | null = null;
      try {
        nextDevice = await registerDevice({
          id: await getOrCreateDeviceId(),
          platform: platform(),
          name: Platform.OS,
        });
      } catch {
        nextDevice = null;
      }

      setIdentity(nextIdentity);
      setProfile(nextProfile);
      setConsents(nextConsents);
      setDevice(nextDevice);
    } catch {
      setAuthError(true);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setTimeout(() => {
          void hydrate();
        }, 0);
      }
      if (event === 'SIGNED_OUT') {
        setIdentity(null);
        setProfile(null);
        setConsents([]);
        setDevice(null);
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [hydrate]);

  const saveOnboarding = useCallback(
    async (input: OnboardingInput): Promise<SaveResult> => {
      const validation = validateOnboarding(input);
      if (!validation.ok) return { ok: false, errors: validation.error };
      if (!identity) return { ok: false, errors: [{ code: 'profile_not_found' }] };

      const next = profile
        ? updateLearnerProfile(profile, validation.value, new Date())
        : createLearnerProfile(validation.value, {
            id: generateUuidV7(),
            userId: identity.userId,
            now: new Date(),
          });

      if (!next.ok) return { ok: false, errors: next.error };

      let saved: LearnerProfile;
      try {
        saved = await saveProfile(next.value);
      } catch {
        return { ok: false, errors: [{ code: 'save_failed' }] };
      }

      setProfile(saved);
      return { ok: true, errors: [] };
    },
    [identity, profile],
  );

  const updateProfile = useCallback(
    async (patch: Parameters<typeof updateLearnerProfile>[1]): Promise<SaveResult> => {
      if (!profile) return { ok: false, errors: [{ code: 'profile_not_found' }] };
      const updated = updateLearnerProfile(profile, patch, new Date());
      if (!updated.ok) return { ok: false, errors: updated.error };

      setProfile(updated.value);
      void saveProfile(updated.value)
        .then((savedProfile) => setProfile(savedProfile))
        .catch(() => {
          void hydrate();
        });
      return { ok: true, errors: [] };
    },
    [hydrate, profile],
  );

  const grant = useCallback(
    async (kind: ConsentKind, version: string = CONSENT_VERSION): Promise<void> => {
      if (!identity) return;
      const next = grantConsent(consents, {
        id: generateUuidV7(),
        userId: identity.userId,
        kind,
        version,
        now: new Date(),
      });
      const record = next.find((entry) => entry.kind === kind && entry.version === version);
      if (!record) return;

      setConsents(next);
      void saveConsents([record]).catch(() => {
        void hydrate();
      });
    },
    [consents, hydrate, identity],
  );

  const grantMany = useCallback(
    async (kinds: readonly ConsentKind[], version: string = CONSENT_VERSION): Promise<void> => {
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

      const changed = next.filter(
        (record) => record.version === version && kinds.includes(record.kind),
      );
      setConsents(next);
      void saveConsents(changed).catch(() => {
        void hydrate();
      });
    },
    [consents, hydrate, identity],
  );

  const revoke = useCallback(
    async (kind: ConsentKind, version: string = CONSENT_VERSION): Promise<void> => {
      const next = revokeConsent(consents, kind, version, new Date());
      const record = next.find((entry) => entry.kind === kind && entry.version === version);
      if (!record) return;

      setConsents(next);
      void saveConsents([record]).catch(() => {
        void hydrate();
      });
    },
    [consents, hydrate],
  );

  const revokeMany = useCallback(
    async (kinds: readonly ConsentKind[], version: string = CONSENT_VERSION): Promise<void> => {
      if (!identity) return;
      let next = consents;
      for (const kind of kinds) {
        next = revokeConsent(next, kind, version, new Date());
      }

      const changed = next.filter(
        (record) => record.version === version && kinds.includes(record.kind),
      );
      setConsents(next);
      void saveConsents(changed).catch(() => {
        void hydrate();
      });
    },
    [consents, hydrate, identity],
  );

  const exportJson = useCallback(async (): Promise<string> => {
    const remote = await fetchServerExport();
    if (!remote) throw new Error('export_failed');
    return remote;
  }, []);

  const resetLocal = useCallback(async (): Promise<void> => {
    await supabase?.auth.signOut().catch(() => undefined);
    setProfile(null);
    setConsents([]);
    setDevice(null);
    setIdentity(null);
  }, []);

  const retry = useCallback(() => {
    void hydrate();
  }, [hydrate]);

  const t = useMemo(() => createTranslator(profile?.uiLocale ?? 'it'), [profile?.uiLocale]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      hydrated,
      authError,
      identity,
      profile,
      consents,
      device,
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
      retry,
    }),
    [
      authError,
      consents,
      device,
      exportJson,
      grant,
      grantMany,
      hydrated,
      identity,
      profile,
      resetLocal,
      retry,
      revoke,
      revokeMany,
      saveOnboarding,
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
