import '../tamagui.generated.css';

import { colors } from '@loqua/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { ProfileProvider } from '../src/providers/ProfileProvider';
import { tamaguiConfig } from '../tamagui.config';

export default function RootLayout() {
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
