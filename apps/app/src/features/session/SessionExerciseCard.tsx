import type { PlacementFeedback, PlacementItem, PlacementStart } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { speakText } from '../../lib/speech';
import { PlacementQuestionCard } from '../placement/PlacementQuestionCard';
import { useProfile } from '../../providers/ProfileProvider';

export interface SessionExerciseCardProps {
  readonly item: PlacementItem;
  readonly progress: PlacementStart['progress'];
  readonly eyebrow: string;
  readonly selected: string | null;
  readonly feedback: PlacementFeedback | null;
  readonly busy: boolean;
  readonly error: boolean;
  readonly phraseSaved: boolean;
  onChoose(answer: { readonly optionId?: string; readonly text?: string }): void;
  onAdvance(): void;
  onSavePhrase(text: string): void;
}

export function SessionExerciseCard(props: SessionExerciseCardProps) {
  const { item, feedback, busy, onChoose, onAdvance } = props;
  const { t } = useProfile();
  const [text, setText] = useState('');
  const [tokens, setTokens] = useState<readonly string[]>([]);

  useEffect(() => {
    setText('');
    setTokens([]);
  }, [item.id]);

  if (item.answerMode === undefined || item.answerMode === 'mcq') {
    return (
      <PlacementQuestionCard
        item={item}
        progress={props.progress}
        eyebrow={props.eyebrow}
        selected={props.selected}
        feedback={feedback}
        busy={busy}
        error={props.error}
        phraseSaved={props.phraseSaved}
        onChoose={(optionId) => onChoose({ optionId })}
        onAdvance={onAdvance}
        onSavePhrase={() => props.onSavePhrase(feedback?.correctAnswer ?? '')}
      />
    );
  }

  const isOrder = item.answerMode === 'order';
  const answerText = isOrder ? tokens.join(' ') : text;
  const canSubmit = answerText.trim().length > 0 && !busy && !feedback;

  function toggleToken(token: string) {
    if (feedback) return;
    setTokens((current) =>
      current.includes(token)
        ? current.filter((entry) => entry !== token)
        : [...current, token],
    );
  }

  function submit() {
    if (!canSubmit) return;
    onChoose({ text: answerText });
  }

  return (
    <Card>
      <Text style={styles.eyebrow}>{props.eyebrow}</Text>
      <Text style={styles.progress}>
        {t('placement.progress', {
          current: props.progress.answered + 1,
          target: props.progress.target,
        })}
      </Text>
      <Text style={styles.skill}>
        {t('session.exercise.title')} - {item.cefrLevel}
      </Text>
      <Text style={styles.question}>{item.prompt}</Text>

      {item.audioText ? (
        <Button
          label={t('item.listen')}
          variant="secondary"
          onPress={() => speakText(item.audioText ?? '', item.targetLang)}
        />
      ) : null}

      {isOrder ? (
        <View style={styles.wrap}>
          {(item.wordBank ?? []).map((token, index) => (
            <Pressable
              key={`${token}-${index}`}
              onPress={() => toggleToken(token)}
              style={[styles.token, tokens.includes(token) ? styles.tokenSelected : null]}
            >
              <Text style={styles.tokenText}>{token}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          testID="session-text-input"
          value={text}
          onChangeText={setText}
          editable={!busy && !feedback}
          multiline
          placeholder={t('session.exercise.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      )}

      {feedback ? (
        <View style={styles.feedback}>
          <Text style={feedback.correct ? styles.correct : styles.wrong}>
            {feedback.correct ? t('placement.feedback.correct') : t('placement.feedback.wrong')}
          </Text>
          {!feedback.correct && feedback.correctAnswer ? (
            <Text style={styles.body}>
              {t('session.exercise.answer', { answer: feedback.correctAnswer })}
            </Text>
          ) : null}
          <Text style={styles.body}>{feedback.explanation}</Text>
          <Button
            label={props.phraseSaved ? t('session.savedPhrase') : t('session.savePhrase')}
            variant="secondary"
            disabled={props.phraseSaved}
            onPress={() => props.onSavePhrase(feedback.correctAnswer ?? answerText)}
          />
          <Button label={t('placement.next')} onPress={onAdvance} />
        </View>
      ) : (
        <Button
          label={t('session.exercise.check')}
          onPress={submit}
          disabled={!canSubmit}
        />
      )}
      {props.error ? <Text style={styles.error}>{t('placement.error')}</Text> : null}
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
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  token: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  tokenSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  tokenText: { color: colors.text, fontSize: typography.body.fontSize },
  feedback: { gap: spacing.sm },
  correct: { color: colors.success, fontWeight: '700', fontSize: typography.body.fontSize },
  wrong: { color: colors.danger, fontWeight: '700', fontSize: typography.body.fontSize },
  error: { color: colors.danger, fontSize: typography.body.fontSize },
});
