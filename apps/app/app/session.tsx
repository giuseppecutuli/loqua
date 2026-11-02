import type { SessionRationaleCode } from '@loqua/core';
import { colors, spacing, typography, type TranslationKey } from '@loqua/ui';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { SessionExerciseCard } from '../src/features/session/SessionExerciseCard';
import { useSession } from '../src/features/session/useSession';
import { useProfile } from '../src/providers/ProfileProvider';

const BLOCK_LABELS: Record<'review' | 'input' | 'production', TranslationKey> = {
  review: 'session.block.review',
  input: 'session.block.input',
  production: 'session.block.production',
};

function isRationale(value: string): value is SessionRationaleCode {
  switch (value) {
    case 'due_review':
    case 'weak_skill':
    case 'new_concept':
    case 'production_practice':
    case 'fallback_foundation':
    case 'error_drill':
      return true;
    default:
      return false;
  }
}

const RATIONALE_LABELS: Record<SessionRationaleCode, TranslationKey> = {
  due_review: 'session.rationale.due_review',
  weak_skill: 'session.rationale.weak_skill',
  new_concept: 'session.rationale.new_concept',
  production_practice: 'session.rationale.production_practice',
  fallback_foundation: 'session.rationale.fallback_foundation',
  error_drill: 'session.rationale.error_drill',
};

export default function SessionScreen() {
  const { t } = useProfile();
  const session = useSession();

  if (session.loading) {
    return (
      <Screen title={t('session.title')}>
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>{t('session.loading')}</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (session.error && !session.session) {
    return (
      <Screen title={t('session.title')}>
        <Card>
          <Text style={styles.error}>{t('session.error')}</Text>
          <Button label={t('common.retry')} onPress={session.reload} />
        </Card>
      </Screen>
    );
  }

  if (!session.session) {
    return (
      <Screen title={t('session.title')}>
        <Card>
          <Text style={styles.body}>{t('session.empty')}</Text>
        </Card>
      </Screen>
    );
  }

  if (session.session.status === 'completed' || !session.session.current) {
    return (
      <Screen title={t('session.completed')}>
        <Card>
          <Text style={styles.body}>{t('session.completedHint')}</Text>
        </Card>
        <Button label={t('session.backToday')} onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const current = session.session.current;
  const rationale = isRationale(current.rationale)
    ? t(RATIONALE_LABELS[current.rationale])
    : current.rationale;
  const eyebrow = `${t(BLOCK_LABELS[current.block])} � ${rationale}`;

  return (
    <Screen title={t('session.title')}>
      <SessionExerciseCard
        item={current.item}
        progress={{ answered: session.session.answered, target: session.session.total }}
        eyebrow={eyebrow}
        selected={session.selected}
        feedback={session.feedback}
        busy={session.busy}
        error={session.error}
        phraseSaved={session.phraseSaved}
        onChoose={(answer) => void session.choose(answer)}
        onSavePhrase={(text) => void session.saveCurrentPhrase(text, current.itemId)}
        onAdvance={session.advance}
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
