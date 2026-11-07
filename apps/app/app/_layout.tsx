import '../tamagui.generated.css';

import { colors } from '@loqua/ui';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { completeAuthRedirect } from '../src/lib/auth-link';
import { trackEvent } from '../src/features/events/api';
import { markNotificationSent } from '../src/features/notifications/api';
import { ensureNotificationHandler } from '../src/lib/notifications';
import { ProfileProvider } from '../src/providers/ProfileProvider';
import { tamaguiConfig } from '../tamagui.config';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ensureNotificationHandler();
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const kind = notification.request.content.data?.kind;
      if (typeof kind === 'string') {
        void markNotificationSent(kind);
        void trackEvent('notification_sent', { kind, channel: 'native' });
      }
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data;
      const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : null;
      const kind = typeof data?.kind === 'string' ? data.kind : null;
      if (kind) {
        void markNotificationSent(kind);
        void trackEvent('notification_opened', { kind });
      }
      if (deepLink) router.push(deepLink as Href);
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Linking.getInitialURL().then((url) => {
      if (url) void completeAuthRedirect(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void completeAuthRedirect(url);
    });
    return () => subscription.remove();
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SafeAreaProvider>
        <ProfileProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </ProfileProvider>
      </SafeAreaProvider>
    </TamaguiProvider>
  );
}
