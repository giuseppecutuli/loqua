import { colors, spacing, typography, type TranslationKey } from '@loqua/ui';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { trackEvent } from '../../lib/api';
import {
  dismissNotificationBanner,
  isNotificationBannerDismissed,
  requestNotificationPermission,
} from '../../lib/notifications';
import { useProfile } from '../../providers/ProfileProvider';
import { useNotifications } from './useNotifications';

export function NotificationBanner() {
  const { t } = useProfile();
  const { plan, prefs, permission, savePrefs, retry } = useNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const banner = plan?.banner ?? null;

  useEffect(() => {
    if (!banner) {
      setDismissed(false);
      return;
    }
    let active = true;
    setDismissed(false);
    void isNotificationBannerDismissed(banner.id).then((value) => {
      if (active) setDismissed(value);
    });
    return () => {
      active = false;
    };
  }, [banner]);

  const showPrompt = permission === 'unknown' && plan?.permissionPrompt === true;
  const showBanner = banner !== null && !dismissed && !showPrompt;

  async function onGrant() {
    setBusy(true);
    try {
      await requestNotificationPermission();
      if (prefs) {
        await savePrefs(prefs);
      } else {
        retry();
      }
    } catch {
      retry();
    } finally {
      setBusy(false);
    }
  }

  async function onOpen() {
    if (!banner) return;
    setDismissed(true);
    await dismissNotificationBanner(banner.id);
    void trackEvent('notification_opened', { kind: banner.kind });
    router.push(banner.deepLink);
  }

  async function onDismiss() {
    if (!banner) return;
    setDismissed(true);
    await dismissNotificationBanner(banner.id);
  }

  if (!plan) return null;

  return (
    <>
      {showPrompt ? (
        <Card>
          <Text style={styles.title}>{t('settings.notifications.permission')}</Text>
          <Text style={styles.body}>{t('settings.notifications.permissionBody')}</Text>
          <Button
            label={t('settings.notifications.grant')}
            onPress={() => void onGrant()}
            disabled={busy}
          />
        </Card>
      ) : null}
      {showBanner && banner ? (
        <Card>
          <Text style={styles.title}>
            {t(banner.titleKey as TranslationKey, banner.params)}
          </Text>
          <Text style={styles.body}>
            {t(banner.bodyKey as TranslationKey, banner.params)}
          </Text>
          <View style={styles.actions}>
            <Button label={t('notifications.banner.open')} onPress={() => void onOpen()} />
            <Button
              label={t('notifications.banner.dismiss')}
              variant="ghost"
              onPress={() => void onDismiss()}
            />
          </View>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
