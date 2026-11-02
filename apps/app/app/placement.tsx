import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { PlacementQuestionCard } from '../src/features/placement/PlacementQuestionCard';
import { PlacementResultCard } from '../src/features/placement/PlacementResultCard';
import { usePlacement } from '../src/features/placement/usePlacement';
import { useProfile } from '../src/providers/ProfileProvider';

export default function PlacementScreen() {
  const { t } = useProfile();
  const placement = usePlacement();

  if (placement.loading) {
    return (
      <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>{t('placement.loading')}</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (placement.error && !placement.session && !placement.result) {
    return (
      <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
        <Card>
          <Text style={styles.error}>{t('placement.error')}</Text>
          <Button label={t('common.retry')} onPress={() => void placement.restart()} />
        </Card>
      </Screen>
    );
  }

  if (placement.result) {
    return (
      <Screen title={t('placement.result.title')} subtitle={t('placement.result.subtitle')}>
        <PlacementResultCard
          result={placement.result}
          onContinue={() => router.replace('/(tabs)')}
          onRedo={() => void placement.restart()}
        />
      </Screen>
    );
  }

  if (!placement.session) {
    return (
      <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
        <Card>
          <Text style={styles.body}>{t('placement.loading')}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
      <PlacementQuestionCard
        item={placement.session.item}
        progress={placement.session.progress}
        selected={placement.selected}
        feedback={placement.feedback}
        busy={placement.busy}
        error={placement.error}
        onChoose={(optionId) => void placement.choose(optionId)}
        onAdvance={placement.advance}
      />
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
