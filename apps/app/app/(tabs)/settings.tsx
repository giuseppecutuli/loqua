import { CONSENT_KINDS, hasActiveConsent, type ConsentKind } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import {
  fetchDevices,
  hasRemoteSession,
  requestServerDelete,
  revokeDevice,
} from '../../src/lib/api';
import { confirmDestructive } from '../../src/lib/confirm';
import { CONSENT_LABELS } from '../../src/lib/labels';
import { shareExport } from '../../src/lib/share';
import { supabase, supabaseConfigured } from '../../src/lib/supabase';
import { useProfile } from '../../src/providers/ProfileProvider';

const MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
const UI_LOCALES = ['it', 'en'] as const;

function languageName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

interface RemoteDevice {
  readonly id: string;
  readonly platform: string;
  readonly name: string | null;
}

export default function SettingsScreen() {
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

  useEffect(() => {
    if (profile) void loadDevices();
  }, [loadDevices, profile]);

  if (!profile) return null;

  const otherDevices = remoteDevices.filter((entry) => entry.id !== device?.id);

  function onConsentChange(kind: ConsentKind, enabled: boolean) {
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
  }

  async function onExport() {
    try {
      const text = await exportJson();
      await shareExport(text, `loqua-export-${new Date().toISOString().slice(0, 10)}.json`);
      Alert.alert(t('settings.exportDone'));
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function onDelete() {
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
          router.replace('/onboarding');
        })();
      },
    );
  }

  function onRevokeDevice(deviceId: string) {
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
  }

  async function onSendMagicLink() {
    if (!supabase || email.trim().length === 0) return;
    const address = email.trim();
    const session = await supabase.auth.getSession();
    const { error } = session.data.session
      ? await supabase.auth.updateUser({ email: address })
      : await supabase.auth.signInWithOtp({ email: address });
    setEmailMessage(error ? t('errors.generic') : t('auth.magicLinkSent'));
  }

  return (
    <Screen title={t('settings.title')}>
      <Card>
        <Text style={styles.section}>{t('settings.language')}</Text>
        <Text style={styles.row}>
          {t('settings.targetLang')}: {languageName(t.locale, profile.targetLang)}
        </Text>
        <Text style={styles.row}>
          {t('settings.nativeLang')}: {languageName(t.locale, profile.nativeLang)}
        </Text>
        <Text style={styles.row}>{t('settings.uiLocale')}</Text>
        <View style={styles.wrap}>
          {UI_LOCALES.map((locale) => (
            <Chip
              key={locale}
              label={languageName(t.locale, locale)}
              selected={profile.uiLocale === locale}
              onPress={() => {
                void updateProfile({ uiLocale: locale });
              }}
            />
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.row}>{t('settings.explanationMode')}</Text>
          <Switch
            value={profile.explanationMode === 'native'}
            onValueChange={(value) => {
              void updateProfile({ explanationMode: value ? 'native' : 'target_simple' });
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Text style={styles.row}>
          {t(
            profile.explanationMode === 'native'
              ? 'settings.explanation.native'
              : 'settings.explanation.target_simple',
          )}
        </Text>
      </Card>

      <Card>
        <Text style={styles.section}>{t('settings.dailyMinutes')}</Text>
        <View style={styles.wrap}>
          {MINUTE_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={t('common.minutes', { count: minutes })}
              selected={profile.dailyMinutes === minutes}
              onPress={() => {
                void updateProfile({ dailyMinutes: minutes });
              }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>{t('settings.consents')}</Text>
        {CONSENT_KINDS.map((kind) => (
          <View key={kind} style={styles.switchRow}>
            <Text style={styles.row}>{t(CONSENT_LABELS[kind])}</Text>
            <Switch
              value={hasActiveConsent(consents, kind)}
              onValueChange={(enabled) => onConsentChange(kind, enabled)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>{t('settings.devices')}</Text>
        {device ? (
          <Text style={styles.row}>
            {t('settings.currentDevice')}: {device.platform}
            {device.name ? ` · ${device.name}` : ''}
          </Text>
        ) : null}
        {otherDevices.map((entry) => (
          <View key={entry.id} style={styles.deviceRow}>
            <Text style={styles.row}>
              {entry.name ?? entry.platform} · {entry.platform}
            </Text>
            <Button
              label={t('settings.revokeDevice')}
              variant="ghost"
              onPress={() => onRevokeDevice(entry.id)}
            />
          </View>
        ))}
        {otherDevices.length === 0 ? (
          <Text style={styles.row}>{t('settings.noDevices')}</Text>
        ) : null}
        {deviceMessage ? <Text style={styles.row}>{deviceMessage}</Text> : null}
      </Card>

      {supabaseConfigured && identity?.isAnonymous ? (
        <Card>
          <Text style={styles.section}>{t('auth.upgrade')}</Text>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button label={t('auth.upgrade')} variant="secondary" onPress={onSendMagicLink} />
          {emailMessage ? <Text style={styles.row}>{emailMessage}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <Button label={t('settings.export')} variant="secondary" onPress={onExport} />
        <Button label={t('settings.delete')} variant="danger" onPress={onDelete} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  row: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    flexShrink: 1,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
