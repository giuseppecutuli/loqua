import { CONSENT_KINDS, hasActiveConsent } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useSettings } from '../../src/features/settings/useSettings';
import { CONSENT_LABELS } from '../../src/lib/labels';

const MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
const UI_LOCALES = ['it', 'en'] as const;
const NOTIFICATION_MAX_OPTIONS = [1, 2] as const;

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
    updateProfile,
    supabaseConfigured,
    email,
    emailMessage,
    otherDevices,
    deviceMessage,
    notificationPrefs,
    notificationPermission,
    notificationSaved,
    notificationPermissionLabel,
    setEmail,
    onConsentChange,
    onExport,
    onDelete,
    onSignOut,
    onRevokeDevice,
    onSendMagicLink,
    persistNotificationPrefs,
    onGrantNotifications,
  } = useSettings();

  if (!profile) return null;

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
        <Text style={styles.section}>{t('settings.notifications')}</Text>
        {notificationPrefs ? (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.row}>{t('settings.notifications.enable')}</Text>
              <Switch
                value={notificationPrefs.enabled}
                onValueChange={(enabled) => {
                  persistNotificationPrefs({ ...notificationPrefs, enabled });
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.row}>{t('settings.notifications.permission')}</Text>
              {notificationPermission === 'unknown' ? (
                <Button
                  label={t('settings.notifications.grant')}
                  variant="secondary"
                  onPress={onGrantNotifications}
                />
              ) : (
                <Text style={styles.row}>{notificationPermissionLabel}</Text>
              )}
            </View>

            <Text style={styles.row}>{t('settings.notifications.maxPerDay')}</Text>
            <View style={styles.wrap}>
              {NOTIFICATION_MAX_OPTIONS.map((value) => (
                <Chip
                  key={value}
                  label={t.formatNumber(value)}
                  selected={notificationPrefs.maxPerDay === value}
                  onPress={() => {
                    persistNotificationPrefs({ ...notificationPrefs, maxPerDay: value });
                  }}
                />
              ))}
            </View>

            <Text style={styles.row}>
              {t('settings.notifications.quietHours')}: {notificationPrefs.quietHours.join(' – ')}
            </Text>

            {notificationSaved ? (
              <Text style={styles.row}>{t('settings.notifications.saved')}</Text>
            ) : null}
          </>
        ) : null}
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
          <Button
            label={t('auth.signInExisting')}
            variant="ghost"
            onPress={() => router.push('/login')}
          />
          {emailMessage ? <Text style={styles.row}>{emailMessage}</Text> : null}
        </Card>
      ) : null}

      {identity && !identity.isAnonymous ? (
        <Card>
          <Text style={styles.section}>{t('auth.account')}</Text>
          {identity.email ? (
            <Text style={styles.row}>{t('auth.signedInAs', { email: identity.email })}</Text>
          ) : null}
          <Button label={t('auth.signOut')} variant="danger" onPress={onSignOut} />
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
