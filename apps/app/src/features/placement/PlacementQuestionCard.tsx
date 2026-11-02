import type { PlacementFeedback, PlacementItem, PlacementStart } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SKILL_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

export interface PlacementQuestionCardProps {
  readonly item: PlacementItem;
  readonly progress: PlacementStart['progress'];
  readonly eyebrow?: string;
  readonly selected: string | null;
  readonly feedback: PlacementFeedback | null;
  readonly busy: boolean;
  readonly error: boolean;
  onChoose(optionId: string): void;
  onAdvance(): void;
}

export function PlacementQuestionCard({
  item,
  progress,
  eyebrow,
  selected,
  feedback,
  busy,
  error,
  onChoose,
  onAdvance,
}: PlacementQuestionCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.progress}>
        {t('placement.progress', {
          current: progress.answered + 1,
          target: progress.target,
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
          const disabled = busy || feedback !== null;
          return (
            <Pressable
              key={option.id}
              testID={`placement-option-${option.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: selected === option.id }}
              disabled={disabled}
              onPress={() => onChoose(option.id)}
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
          <Button label={t('placement.next')} onPress={onAdvance} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{t('placement.error')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
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
});
