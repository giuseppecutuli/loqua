import { CONSENT_KINDS, hasActiveConsent, type ConsentKind } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
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

export default function SettingsScreen() {
  const {
    t,
    profile,
    consents,
    identity,
    device,
    pendingWrites,
    storage,
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

  if (!profile) return null;

  function onConsentChange(kind: ConsentKind, enabled: boolean) {
    if (kind === 'voice') {
      if (enabled) {
        grantMany(['ai_processing', 'voice']);
      } else {
        revoke('voice');
      }
      return;
    }

    if (kind === 'ai_processing' && !enabled) {
      revokeMany(['ai_processing', 'voice']);
      return;
    }

    if (enabled) {
      grant(kind);
    } else {
      revoke(kind);
    }
  }

  async function onExport() {
    const text = await exportJson();
    await shareExport(text, `loqua-export-${new Date().toISOString().slice(0, 10)}.json`);
    Alert.alert(t('settings.exportDone'));
  }

  function onDelete() {
    confirmDestructive(
      t('settings.delete'),
      t('settings.deleteConfirm'),
      t('settings.delete'),
      t('common.cancel'),
      () => {
        resetLocal();
        router.replace('/onboarding');
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
              onPress={() => updateProfile({ uiLocale: locale })}
            />
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.row}>{t('settings.explanationMode')}</Text>
          <Switch
            value={profile.explanationMode === 'native'}
            onValueChange={(value) => {
              updateProfile({ explanationMode: value ? 'native' : 'target_simple' });
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
              onPress={() => updateProfile({ dailyMinutes: minutes })}
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
        <Text style={styles.section}>{t('settings.sync')}</Text>
        <Text style={styles.row}>{t('sync.pending', { count: pendingWrites })}</Text>
        <Text style={styles.row}>
          {t('settings.storage')}: {storage}
        </Text>
        {!supabaseConfigured ? <Text style={styles.row}>{t('settings.localOnly')}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.section}>{t('settings.devices')}</Text>
        {device ? (
          <Text style={styles.row}>
            {t('settings.currentDevice')}: {device.platform}
            {device.name ? ` · ${device.name}` : ''}
          </Text>
        ) : null}
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
});
