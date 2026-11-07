import type { SessionRationaleCode } from '@loqua/core';
import { colors, typography, type TranslationKey } from '@loqua/ui';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { StateCard } from '../src/components/StateCard';
import { SessionExerciseCard } from '../src/features/session/SessionExerciseCard';
import { useSession } from '../src/features/session/useSession';
import { trackEvent } from '../src/features/events/api';
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
  const completedSessionId = useRef<string | null>(null);

  useEffect(() => {
    const value = session.session;
    if (!value) return;
    if (value.status !== 'completed' && value.current) return;
    if (completedSessionId.current === value.id) return;
    completedSessionId.current = value.id;
    void trackEvent('session_completed', {
      kind: 'lesson',
      items: value.total,
    });
  }, [session.session]);

  if (session.loading) {
    return (
      <Screen title={t('session.title')}>
        <StateCard variant="loading" message={t('session.loading')} />
      </Screen>
    );
  }

  if (session.error && !session.session) {
    return (
      <Screen title={t('session.title')}>
        <StateCard
          variant="error"
          message={t('session.error')}
          actionLabel={t('common.retry')}
          onAction={session.reload}
        />
      </Screen>
    );
  }

  if (!session.session) {
    return (
      <Screen title={t('session.title')}>
        <StateCard message={t('session.empty')} />
      </Screen>
    );
  }

  if (!session.session.current && session.session.status === 'completed') {
    return (
      <Screen title={t('session.title')}>
        <Card>
          <Text style={styles.title}>{t('session.completed')}</Text>
          <Text style={styles.body}>{t('session.completedHint')}</Text>
          <Button label={t('session.backToday')} onPress={() => router.replace('/(tabs)')} />
        </Card>
      </Screen>
    );
  }

  if (!session.session.current) {
    return (
      <Screen title={t('session.title')}>
        <Card>
          <Text style={styles.body}>{t('session.empty')}</Text>
        </Card>
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
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
