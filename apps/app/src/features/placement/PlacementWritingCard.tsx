import { countWords, validateWritingResponse, type WritingTask } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface PlacementWritingCardProps {
  readonly task: WritingTask;
  readonly busy: boolean;
  readonly error: boolean;
  onSubmit(text: string): void;
  onSkip(): void;
}

export function PlacementWritingCard({
  task,
  busy,
  error,
  onSubmit,
  onSkip,
}: PlacementWritingCardProps) {
  const { t, aiAllowed, grant } = useProfile();
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState<'too_short' | 'too_long' | null>(null);
  const wordCount = countWords(text);

  function submit() {
    const validation = validateWritingResponse(text, task);
    if (!validation.ok) {
      setLocalError(validation.error);
      return;
    }
    setLocalError(null);
    onSubmit(text);
  }

  return (
    <Card>
      <Text style={styles.title}>{t('placement.writing.title')}</Text>
      <Text style={styles.body}>{task.prompt}</Text>
      <Text style={styles.hint}>{t('placement.writing.hint')}</Text>
      <TextInput
        testID="placement-writing-input"
        value={text}
        onChangeText={(value) => {
          setText(value);
          setLocalError(null);
        }}
        placeholder={t('placement.writing.placeholder')}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={styles.input}
      />
      <Text style={styles.meta}>
        {t('placement.writing.words', {
          count: wordCount,
          min: task.minWords,
          max: task.maxWords,
        })}
      </Text>

      {localError === 'too_short' ? (
        <Text style={styles.error}>{t('placement.writing.tooShort', { min: task.minWords })}</Text>
      ) : null}
      {localError === 'too_long' ? (
        <Text style={styles.error}>{t('placement.writing.tooLong', { max: task.maxWords })}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{t('placement.error')}</Text> : null}

      {!aiAllowed ? (
        <View style={styles.consent}>
          <Text style={styles.body}>{t('placement.writing.consent')}</Text>
          <Button
            label={t('placement.writing.grant')}
            variant="secondary"
            onPress={() => void grant('ai_processing')}
          />
        </View>
      ) : null}

      {busy ? <Text style={styles.hint}>{t('placement.writing.evaluating')}</Text> : null}
      <Button
        label={t('placement.writing.submit')}
        onPress={submit}
        disabled={busy || !aiAllowed || text.trim().length === 0}
      />
      <Button
        label={t('placement.writing.skip')}
        variant="ghost"
        onPress={onSkip}
        disabled={busy}
      />
    </Card>
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
  hint: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  input: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  consent: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
