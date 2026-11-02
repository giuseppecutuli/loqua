import { colors, spacing, typography } from '@loqua/ui';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { useProfile } from '../src/providers/ProfileProvider';

export default function Index() {
  const { hydrated, authError, profile, retry, t } = useProfile();

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (authError) {
    return (
      <Screen title={t('common.appName')}>
        <Card>
          <Text style={styles.error}>{t('errors.network')}</Text>
          <Button label={t('common.retry')} onPress={retry} />
        </Card>
      </Screen>
    );
  }

  if (!profile || !profile.onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  error: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing.md,
  },
});
