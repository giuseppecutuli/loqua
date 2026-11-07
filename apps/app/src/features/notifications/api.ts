import {
  notificationPlanSchema,
  notificationPreferencesSchema,
  type NotificationPermission,
  type NotificationPlan,
  type NotificationPreferences,
} from '@loqua/core';

import { parseEnvelope, request } from '../../lib/http';

export async function fetchNotifications(
  permission: NotificationPermission,
): Promise<{ readonly prefs: NotificationPreferences; readonly plan: NotificationPlan }> {
  const body: unknown = await (
    await request(`/v1/notifications?permission=${encodeURIComponent(permission)}`)
  ).json();
  return {
    prefs: parseEnvelope(body, 'prefs', notificationPreferencesSchema, 'invalid_notifications'),
    plan: parseEnvelope(body, 'plan', notificationPlanSchema, 'invalid_notifications'),
  };
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const body: unknown = await (
    await request('/v1/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ prefs }),
    })
  ).json();
  return parseEnvelope(body, 'prefs', notificationPreferencesSchema, 'invalid_notifications');
}

export async function markNotificationSent(kind: string): Promise<void> {
  await request('/v1/notifications/sent', {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}
