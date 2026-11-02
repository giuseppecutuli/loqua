import type {
  PlacementAnswer,
  PlacementFeedback,
  PlacementItem,
  PlacementResult,
  PlacementStart,
} from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { answerPlacement, startPlacement } from '../src/lib/api';
import { SKILL_LABELS } from '../src/lib/labels';
import { useProfile } from '../src/providers/ProfileProvider';

export default function PlacementScreen() {
  const { t, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [session, setSession] = useState<PlacementStart | null>(null);
  const [pending, setPending] = useState<PlacementAnswer | null>(null);
  const [feedback, setFeedback] = useState<PlacementFeedback | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSession(await startPlacement());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(optionId: string) {
    if (!session || busy || feedback) return;
    setBusy(true);
    setSelected(optionId);
    setError(false);
    try {
      const answer = await answerPlacement(session.assessmentId, session.item.id, optionId);
      setFeedback(answer.feedback);
      if (answer.completed && answer.result) {
        setResult(answer.result);
        await refreshProfile();
      } else if (answer.completed) {
        setError(true);
      } else {
        setPending(answer);
      }
    } catch {
      setError(true);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (result) {
      router.replace('/(tabs)');
      return;
    }
    const nextItem = pending?.item;
    if (!pending || !nextItem) return;
    const nextProgress = pending.progress;
    setSession((current) =>
      current ? { ...current, item: nextItem, progress: nextProgress } : current,
    );
    setPending(null);
    setFeedback(null);
    setSelected(null);
  }

  if (loading) {
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

  if (error && !session && !result) {
    return (
      <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
        <Card>
          <Text style={styles.error}>{t('placement.error')}</Text>
          <Button label={t('common.retry')} onPress={() => void load()} />
        </Card>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen title={t('placement.result.title')} subtitle={t('placement.result.subtitle')}>
        <Card>
          <Text testID="placement-level" style={styles.level}>
            {result.overallRange ?? result.overallLevel ?? '-'}
          </Text>
          <Text style={styles.body}>
            {t('placement.result.overall')}: {result.overallLevel ?? '-'}
          </Text>
          <Text style={styles.meta}>
            {t('placement.result.range')}: {result.overallRange ?? '-'}
          </Text>
          <Text style={styles.meta}>
            {t('placement.result.confidence')}: {Math.round(result.confidence * 100)}%
          </Text>
        </Card>

        {result.priorities.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>{t('placement.result.priorities')}</Text>
            {result.priorities.map((priority) => (
              <Text key={priority.skill} style={styles.body}>
                {t('placement.result.priority', {
                  skill: t(SKILL_LABELS[priority.skill]),
                  level: priority.level,
                })}
              </Text>
            ))}
          </Card>
        ) : null}

        {result.unmeasured.length > 0 ? (
          <Card>
            <Text style={styles.meta}>
              {t('placement.result.unmeasured', {
                skills: result.unmeasured.map((skill) => t(SKILL_LABELS[skill])).join(', '),
              })}
            </Text>
          </Card>
        ) : null}

        <Button label={t('placement.result.continue')} onPress={next} />
        <Button
          label={t('placement.result.redo')}
          variant="ghost"
          onPress={() => {
            setResult(null);
            setSession(null);
            setFeedback(null);
            setPending(null);
            void load();
          }}
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
        <Card>
          <Text style={styles.body}>{t('placement.loading')}</Text>
        </Card>
      </Screen>
    );
  }

  const item: PlacementItem = session.item;

  return (
    <Screen title={t('placement.title')} subtitle={t('placement.subtitle')}>
      <Card>
        <Text style={styles.progress}>
          {t('placement.progress', {
            current: session.progress.answered + 1,
            target: session.progress.target,
          })}
        </Text>
        <Text style={styles.skill}>
          {t(SKILL_LABELS[item.skill])} · {item.cefrLevel}
        </Text>
        <Text style={styles.question}>{item.prompt}</Text>
        <View style={styles.options}>
          {item.options.map((option) => {
            const isCorrect = feedback?.correctOptionId === option.id;
            const isWrong = feedback !== null && selected === option.id && !feedback.correct;
            return (
              <Pressable
                key={option.id}
                testID={`placement-option-${option.id}`}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: busy || feedback !== null,
                  selected: selected === option.id,
                }}
                disabled={busy || feedback !== null}
                onPress={() => void choose(option.id)}
                style={({ pressed }) => [
                  styles.option,
                  pressed ? styles.optionPressed : null,
                  selected === option.id ? styles.optionSelected : null,
                  isCorrect ? styles.optionCorrect : null,
                  isWrong ? styles.optionWrong : null,
                ]}
              >
                <Text style={styles.optionText}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>

        {feedback ? (
          <View style={styles.feedback}>
            <Text style={feedback.correct ? styles.correct : styles.wrong}>
              {feedback.correct ? t('placement.feedback.correct') : t('placement.feedback.wrong')}
            </Text>
            <Text style={styles.body}>{feedback.explanation}</Text>
            <Button label={t('placement.next')} onPress={next} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{t('placement.error')}</Text> : null}
      </Card>
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
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  progress: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
  },
  skill: {
    color: colors.primary,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  question: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  optionText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  feedback: {
    gap: spacing.sm,
  },
  correct: {
    color: colors.success,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '700',
  },
  wrong: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  level: {
    color: colors.text,
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
});
