import { colors, typography } from '@loqua/ui';
import { Tabs } from 'expo-router';

import { useProfile } from '../../src/providers/ProfileProvider';

export default function TabsLayout() {
  const { t } = useProfile();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.today') }} />
      <Tabs.Screen name="practice" options={{ title: t('nav.practice') }} />
      <Tabs.Screen name="talk" options={{ title: t('nav.talk') }} />
      <Tabs.Screen name="progress" options={{ title: t('nav.progress') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
