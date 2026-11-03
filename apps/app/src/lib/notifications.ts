import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationPermissionSchema, type NotificationPermission } from '@loqua/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PERMISSION_KEY = 'loqua.notification.permission';
const BANNER_KEY_PREFIX = 'loqua.notification.banner.';
const IS_WEB = Platform.OS === 'web';

interface WebNotification {
  close(): void;
}

interface WebNotificationConstructor {
  readonly permission: 'default' | 'granted' | 'denied';
  requestPermission(): Promise<'default' | 'granted' | 'denied'>;
  new (title: string, options?: { readonly body?: string }): WebNotification;
}

let handlerConfigured = false;

export function ensureNotificationHandler(): void {
  if (IS_WEB || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function webNotificationConstructor(): WebNotificationConstructor | null {
  if (!IS_WEB) return null;
  const candidate: unknown = Reflect.get(globalThis, 'Notification');
  if (typeof candidate !== 'function') return null;
  return candidate as WebNotificationConstructor;
}

function mapPermission(value: string): NotificationPermission {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  return 'unknown';
}

async function nativePermission(): Promise<NotificationPermission> {
  ensureNotificationHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (current.status === 'denied' || current.canAskAgain === false) return 'denied';
  return 'unknown';
}

export async function loadNotificationPermission(): Promise<NotificationPermission> {
  const stored = await AsyncStorage.getItem(PERMISSION_KEY);
  const parsed = notificationPermissionSchema.safeParse(stored);
  if (!IS_WEB) {
    try {
      const current = await nativePermission();
      if (current === 'unknown') return parsed.success ? parsed.data : 'unknown';
      await AsyncStorage.setItem(PERMISSION_KEY, current);
      return current;
    } catch {
      return parsed.success ? parsed.data : 'unknown';
    }
  }
  return parsed.success ? parsed.data : 'unknown';
}

export async function persistNotificationPermission(
  permission: NotificationPermission,
): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_KEY, permission);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!IS_WEB) {
    const stored = await loadNotificationPermission();
    if (stored === 'denied') return 'denied';
    ensureNotificationHandler();
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.status === 'granted') {
        await persistNotificationPermission('granted');
        return 'granted';
      }
      if (current.status === 'denied' || current.canAskAgain === false) {
        await persistNotificationPermission('denied');
        return 'denied';
      }
      const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      });
      const mapped: NotificationPermission =
        result.status === 'granted' ? 'granted' : 'denied';
      await persistNotificationPermission(mapped);
      return mapped;
    } catch {
      return 'unknown';
    }
  }

  const NotificationApi = webNotificationConstructor();
  if (!NotificationApi) {
    await persistNotificationPermission('unsupported');
    return 'unsupported';
  }

  const stored = await loadNotificationPermission();
  if (stored === 'denied') return 'denied';

  const current = mapPermission(NotificationApi.permission);
  if (current === 'denied' || current === 'granted') {
    await persistNotificationPermission(current);
    return current;
  }

  try {
    const result = mapPermission(await NotificationApi.requestPermission());
    await persistNotificationPermission(result);
    return result;
  } catch {
    return 'unknown';
  }
}

export async function isNotificationBannerDismissed(id: string): Promise<boolean> {
  return (await AsyncStorage.getItem(`${BANNER_KEY_PREFIX}${id}`)) === '1';
}

export async function dismissNotificationBanner(id: string): Promise<void> {
  await AsyncStorage.setItem(`${BANNER_KEY_PREFIX}${id}`, '1');
}

export function canPresentNotifications(): boolean {
  return !IS_WEB || webNotificationConstructor() !== null;
}

export interface NativeNotification {
  readonly id: string;
  readonly fireAt: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink: string;
  readonly kind: string;
}

export async function presentNotification(notification: NativeNotification): Promise<boolean> {
  if (!IS_WEB) {
    ensureNotificationHandler();
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notification.id,
        content: {
          title: notification.title,
          body: notification.body,
          data: { deepLink: notification.deepLink, kind: notification.kind },
        },
        trigger: null,
      });
      return true;
    } catch {
      return false;
    }
  }

  const NotificationApi = webNotificationConstructor();
  if (!NotificationApi) return false;
  try {
    new NotificationApi(notification.title, { body: notification.body });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleNativeNotifications(
  notifications: readonly NativeNotification[],
): Promise<void> {
  if (IS_WEB) return;
  ensureNotificationHandler();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return;
  }
  const now = Date.now();
  for (const notification of notifications) {
    const fireAt = Date.parse(notification.fireAt);
    if (!Number.isFinite(fireAt) || fireAt <= now) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notification.id,
        content: {
          title: notification.title,
          body: notification.body,
          data: { deepLink: notification.deepLink, kind: notification.kind },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
        },
      });
    } catch {
      // A single failed schedule must not block the rest of the plan.
    }
  }
}
