import type {
  ConsentKind,
  ConsentRecord,
  Device,
  LearnerProfile,
  NotificationPermission,
  NotificationPreferences,
} from '@loqua/core';
import type { Translator } from '@loqua/ui';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { fetchDevices, hasRemoteSession, requestServerDelete, revokeDevice } from '../account/api';
import { emailRedirectUrl } from '../../lib/auth-link';
import { confirmDestructive } from '../../lib/confirm';
import type { Identity } from '../../lib/identity';
import { fetchNotifications, saveNotificationPreferences } from '../notifications/api';
import { loadNotificationPermission, requestNotificationPermission } from '../../lib/notifications';
import { shareExport } from '../../lib/share';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { useProfile } from '../../providers/ProfileProvider';

export interface RemoteDevice {
  readonly id: string;
  readonly platform: string;
  readonly name: string | null;
}

export interface SettingsController {
  readonly profile: LearnerProfile | null;
  readonly consents: readonly ConsentRecord[];
  readonly identity: Identity | null;
  readonly device: Device | null;
  readonly t: Translator;
  readonly supabaseConfigured: boolean;
  readonly email: string;
  readonly emailMessage: string | null;
  readonly remoteDevices: readonly RemoteDevice[];
  readonly otherDevices: readonly RemoteDevice[];
  readonly deviceMessage: string | null;
  readonly notificationPrefs: NotificationPreferences | null;
  readonly notificationPermission: NotificationPermission;
  readonly notificationSaved: boolean;
  readonly notificationPermissionLabel: string | null;
  readonly updateProfile: ReturnType<typeof useProfile>['updateProfile'];
  readonly grant: ReturnType<typeof useProfile>['grant'];
  readonly grantMany: ReturnType<typeof useProfile>['grantMany'];
  readonly revoke: ReturnType<typeof useProfile>['revoke'];
  readonly revokeMany: ReturnType<typeof useProfile>['revokeMany'];
  setEmail(value: string): void;
  onConsentChange(kind: ConsentKind, enabled: boolean): void;
  onExport(): void;
  onDelete(): void;
  onSignOut(): void;
  onRevokeDevice(deviceId: string): void;
  onSendMagicLink(): void;
  persistNotificationPrefs(next: NotificationPreferences): void;
  onGrantNotifications(): void;
}

export function useSettings(): SettingsController {
  const {
    t,
    profile,
    consents,
    identity,
    device,
    updateProfile,
    grant,
    grantMany,
    revoke,
    revokeMany,
    exportJson,
    resetLocal,
  } = useProfile();
  const [email, setEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [remoteDevices, setRemoteDevices] = useState<readonly RemoteDevice[]>([]);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('unknown');
  const [notificationSaved, setNotificationSaved] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const devices = await fetchDevices();
      setRemoteDevices(
        devices.map((entry) => ({
          id: entry.id,
          platform: entry.platform,
          name: entry.name,
        })),
      );
    } catch {
      // The next refresh reloads server state.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const permission = await loadNotificationPermission();
      setNotificationPermission(permission);
      const result = await fetchNotifications(permission);
      setNotificationPrefs(result.prefs);
    } catch {
      setNotificationPrefs(null);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      void loadDevices();
      void loadNotifications();
    }
  }, [loadDevices, loadNotifications, profile]);

  useEffect(() => {
    if (!notificationSaved) return;
    const handle = setTimeout(() => setNotificationSaved(false), 2500);
    return () => clearTimeout(handle);
  }, [notificationSaved]);

  const onConsentChange = useCallback(
    (kind: ConsentKind, enabled: boolean) => {
      if (kind === 'voice') {
        if (enabled) {
          void grantMany(['ai_processing', 'voice']);
        } else {
          void revoke('voice');
        }
        return;
      }

      if (kind === 'ai_processing' && !enabled) {
        void revokeMany(['ai_processing', 'voice']);
        return;
      }

      if (enabled) {
        void grant(kind);
      } else {
        void revoke(kind);
      }
    },
    [grant, grantMany, revoke, revokeMany],
  );

  const onExport = useCallback(() => {
    void (async () => {
      try {
        const text = await exportJson();
        await shareExport(text, `loqua-export-${new Date().toISOString().slice(0, 10)}.json`);
        Alert.alert(t('settings.exportDone'));
      } catch {
        Alert.alert(t('errors.generic'));
      }
    })();
  }, [exportJson, t]);

  const onDelete = useCallback(() => {
    confirmDestructive(
      t('settings.delete'),
      t('settings.deleteConfirm'),
      t('settings.delete'),
      t('common.cancel'),
      () => {
        void (async () => {
          if (await hasRemoteSession()) {
            const deleted = await requestServerDelete();
            if (!deleted) {
              Alert.alert(t('errors.generic'));
              return;
            }
          }
          await resetLocal();
          router.replace('/login');
        })();
      },
    );
  }, [resetLocal, t]);

  const onSignOut = useCallback(() => {
    confirmDestructive(
      t('auth.signOut'),
      t('auth.signOutConfirm'),
      t('auth.signOut'),
      t('common.cancel'),
      () => {
        void (async () => {
          await resetLocal();
          router.replace('/login');
        })();
      },
    );
  }, [resetLocal, t]);

  const onRevokeDevice = useCallback(
    (deviceId: string) => {
      confirmDestructive(
        t('settings.revokeDevice'),
        t('settings.revokeConfirm'),
        t('settings.revokeDevice'),
        t('common.cancel'),
        () => {
          void (async () => {
            const revoked = await revokeDevice(deviceId);
            if (revoked) {
              setDeviceMessage(t('settings.deviceRevoked'));
              await loadDevices();
            }
          })();
        },
      );
    },
    [loadDevices, t],
  );

  const onSendMagicLink = useCallback(() => {
    void (async () => {
      if (!supabase || email.trim().length === 0) return;
      const address = email.trim();
      const session = await supabase.auth.getSession();
      const { error } = session.data.session
        ? await supabase.auth.updateUser(
            { email: address },
            { emailRedirectTo: emailRedirectUrl() },
          )
        : await supabase.auth.signInWithOtp({
            email: address,
            options: { emailRedirectTo: emailRedirectUrl() },
          });
      setEmailMessage(error ? t('errors.generic') : t('auth.magicLinkSent'));
    })();
  }, [email, t]);

  const persistNotificationPrefs = useCallback(
    (next: NotificationPreferences) => {
      void (async () => {
        setNotificationPrefs(next);
        setNotificationSaved(false);
        try {
          const saved = await saveNotificationPreferences(next);
          setNotificationPrefs(saved);
          setNotificationSaved(true);
        } catch {
          Alert.alert(t('errors.generic'));
          await loadNotifications();
        }
      })();
    },
    [loadNotifications, t],
  );

  const onGrantNotifications = useCallback(() => {
    void (async () => {
      try {
        const permission = await requestNotificationPermission();
        setNotificationPermission(permission);
        const result = await fetchNotifications(permission);
        setNotificationPrefs(result.prefs);
      } catch {
        Alert.alert(t('errors.generic'));
      }
    })();
  }, [t]);

  const notificationPermissionLabel =
    notificationPermission === 'granted'
      ? t('settings.notifications.granted')
      : notificationPermission === 'denied'
        ? t('settings.notifications.denied')
        : notificationPermission === 'unsupported'
          ? t('settings.notifications.unsupported')
          : null;

  return {
    profile,
    consents,
    identity,
    device,
    t,
    supabaseConfigured,
    email,
    emailMessage,
    remoteDevices,
    otherDevices: remoteDevices.filter((entry) => entry.id !== device?.id),
    deviceMessage,
    notificationPrefs,
    notificationPermission,
    notificationSaved,
    notificationPermissionLabel,
    updateProfile,
    grant,
    grantMany,
    revoke,
    revokeMany,
    setEmail,
    onConsentChange,
    onExport,
    onDelete,
    onSignOut,
    onRevokeDevice,
    onSendMagicLink,
    persistNotificationPrefs,
    onGrantNotifications,
  };
}
