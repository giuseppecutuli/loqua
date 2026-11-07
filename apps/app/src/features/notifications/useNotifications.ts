import type {
  NotificationPlan,
  NotificationPermission,
  NotificationPreferences,
} from '@loqua/core';
import type { TranslationKey } from '@loqua/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { trackEvent } from '../events/api';
import {
  fetchNotifications,
  markNotificationSent,
  saveNotificationPreferences,
} from './api';
import {
  canPresentNotifications,
  loadNotificationPermission,
  presentNotification,
  scheduleNativeNotifications,
} from '../../lib/notifications';
import { useProfile } from '../../providers/ProfileProvider';

export interface NotificationsController {
  readonly loading: boolean;
  readonly prefs: NotificationPreferences | null;
  readonly plan: NotificationPlan | null;
  readonly permission: NotificationPermission;
  savePrefs(prefs: NotificationPreferences): Promise<void>;
  retry(): void;
}

export function useNotifications(): NotificationsController {
  const { t } = useProfile();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [plan, setPlan] = useState<NotificationPlan | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('unknown');
  const shown = useRef<Set<string>>(new Set());

  const schedule = useCallback(
    async (nextPlan: NotificationPlan): Promise<void> => {
      await scheduleNativeNotifications(
        nextPlan.notifications.map((notification) => ({
          id: notification.id,
          fireAt: notification.fireAt,
          title: t(notification.titleKey as TranslationKey, notification.params),
          body: t(notification.bodyKey as TranslationKey, notification.params),
          deepLink: notification.deepLink,
          kind: notification.kind,
        })),
      );
    },
    [t],
  );

  const deliver = useCallback(
    async (
      nextPlan: NotificationPlan,
      nextPermission: NotificationPermission,
    ): Promise<boolean> => {
      if (nextPermission !== 'granted' || !canPresentNotifications()) return false;
      const due = nextPlan.notifications[0];
      if (!due || due.channel !== 'native') return false;
      const fireAt = Date.parse(due.fireAt);
      if (!Number.isFinite(fireAt) || fireAt > Date.now()) return false;
      if (fireAt < Date.now() - 15 * 60_000) {
        try {
          await markNotificationSent(due.kind);
        } catch {
          return false;
        }
        return true;
      }
      if (shown.current.has(due.id)) return false;
      shown.current.add(due.id);
      const delivered = await presentNotification({
        id: due.id,
        fireAt: due.fireAt,
        title: t(due.titleKey as TranslationKey, due.params),
        body: t(due.bodyKey as TranslationKey, due.params),
        deepLink: due.deepLink,
        kind: due.kind,
      });
      if (!delivered) return false;
      try {
        await markNotificationSent(due.kind);
        void trackEvent('notification_sent', { kind: due.kind, channel: due.channel });
      } catch {
        return false;
      }
      return true;
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextPermission = await loadNotificationPermission();
      setPermission(nextPermission);
      const result = await fetchNotifications(nextPermission);
      setPrefs(result.prefs);
      setPlan(result.plan);
      if (await deliver(result.plan, nextPermission)) {
        const refreshed = await fetchNotifications(nextPermission);
        setPrefs(refreshed.prefs);
        setPlan(refreshed.plan);
        await schedule(refreshed.plan);
      } else {
        await schedule(result.plan);
      }
    } catch {
      setPrefs(null);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [deliver, schedule]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const savePrefs = useCallback(
    async (nextPrefs: NotificationPreferences) => {
      await saveNotificationPreferences(nextPrefs);
      await load();
    },
    [load],
  );

  return {
    loading,
    prefs,
    plan,
    permission,
    savePrefs,
    retry: () => void load(),
  };
}
