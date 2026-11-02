import { colors, spacing, typography } from '@loqua/ui';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { LevelEventList } from '../../src/features/progress/LevelEventList';
import { ProgressOverviewCard } from '../../src/features/progress/ProgressOverviewCard';
import { SkillProgressList } from '../../src/features/progress/SkillProgressList';
import { useProgress } from '../../src/features/progress/useProgress';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function ProgressScreen() {
  const { t } = useProfile();
  const { loading, error, progress, reload } = useProgress();

  if (loading) {
    return (
      <Screen title={t('progress.title')}>
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>{t('progress.loading')}</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title={t('progress.title')}>
        <Card>
          <Text style={styles.error}>{t('errors.network')}</Text>
          <Button label={t('common.retry')} onPress={reload} />
        </Card>
      </Screen>
    );
  }

  if (!progress || (progress.skills.length === 0 && progress.events.length === 0)) {
    return (
      <Screen title={t('progress.title')}>
        <Card>
          <Text style={styles.body}>{t('progress.noData')}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('progress.title')}>
      <ProgressOverviewCard progress={progress} />
      <SkillProgressList skills={progress.skills} />
      <LevelEventList events={progress.events} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
