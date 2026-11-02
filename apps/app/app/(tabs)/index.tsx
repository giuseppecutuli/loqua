import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { GOAL_LABELS } from '../../src/lib/labels';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function TodayScreen() {
  const { t, profile } = useProfile();

  return (
    <Screen
      title={t('today.title')}
      subtitle={t.formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
    >
      <Card>
        <Text style={styles.body}>{t('today.empty')}</Text>
        {profile?.goal ? (
          <Text style={styles.meta}>{t(GOAL_LABELS[profile.goal])}</Text>
        ) : null}
        {profile ? (
          <Text style={styles.meta}>
            {t('common.minutes', { count: profile.dailyMinutes })}
          </Text>
        ) : null}
      </Card>

      <Button
        label={t('today.cta')}
        onPress={() => router.push('/(tabs)/practice')}
        disabled
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: spacing.xs,
  },
});
