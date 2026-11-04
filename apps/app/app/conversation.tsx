import { colors, radii, spacing, typography } from '@loqua/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { ConversationVoiceButton } from '../src/features/conversation/ConversationVoiceButton';
import { useConversation } from '../src/features/conversation/useConversation';
import { speakText } from '../src/lib/speech';
import { isStreamingAudioSupported } from '../src/lib/streaming-audio';
import { useProfile } from '../src/providers/ProfileProvider';

export default function ConversationScreen() {
  const { t, profile } = useProfile();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const conversation = useConversation(id);
  const [text, setText] = useState('');
  const streamingSupported = isStreamingAudioSupported();

  if (conversation.loading) {
    return (
      <Screen title={t('talk.loading')}>
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      </Screen>
    );
  }

  if (conversation.error && !conversation.conversation) {
    return (
      <Screen title={t('talk.title')}>
        <Card>
          <Text style={styles.error}>{t('talk.error')}</Text>
          <Button label={t('common.retry')} onPress={conversation.reload} />
        </Card>
      </Screen>
    );
  }

  if (!conversation.conversation) {
    return (
      <Screen title={t('talk.title')}>
        <Card>
          <Text style={styles.body}>{t('talk.error')}</Text>
          <Button label={t('common.back')} onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  async function send() {
    const value = text.trim();
    if (value.length === 0) return;
    await conversation.send(value);
    setText('');
  }

  return (
    <Screen
      title={conversation.conversation.title}
      subtitle={t('talk.level') + ': ' + conversation.conversation.level}
      footer={
        conversation.done ? undefined : (
        <View style={styles.composer}>
          {streamingSupported ? (
            <View style={styles.streaming}>
              <Button
                label={
                  conversation.streaming ? t('talk.stream.stop') : t('talk.stream.record')
                }
                variant={conversation.streaming ? 'secondary' : 'primary'}
                onPress={() => {
                  if (conversation.streaming) conversation.stopVoiceStreaming();
                  else void conversation.sendVoiceStreaming();
                }}
                disabled={
                  conversation.done || (conversation.busy && !conversation.streaming)
                }
              />
              {conversation.streaming ? (
                <Text style={styles.meta}>
                  {conversation.partialTranscript &&
                  conversation.partialTranscript.length > 0
                    ? conversation.partialTranscript
                    : t('talk.stream.listening')}
                </Text>
              ) : null}
            </View>
          ) : null}
          <ConversationVoiceButton
            busy={conversation.busy}
            disabled={conversation.done}
            language={profile?.targetLang ?? 'en'}
            onSend={(audioBase64, durationSec) =>
              void conversation.sendVoice(audioBase64, durationSec)
            }
            onText={(value) => void conversation.send(value)}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('talk.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!conversation.done && !conversation.busy}
            multiline
          />
          <Button
            label={t('talk.send')}
            onPress={() => void send()}
            disabled={conversation.done || conversation.busy || text.trim().length === 0}
          />
          {!conversation.done ? (
            <Button
              label={t('talk.end')}
              variant="ghost"
              onPress={() => void conversation.end()}
              disabled={conversation.busy}
            />
          ) : null}
        </View>
        )
      }
    >
      {conversation.conversation.turns.map((turn) => (
        <View
          key={turn.id}
          style={[styles.bubble, turn.role === 'user' ? styles.userBubble : styles.tutorBubble]}
        >
          <Text style={styles.role}>
            {turn.role === 'user' ? t('talk.you') : t('talk.tutor')}
          </Text>
          <Text style={styles.body}>{turn.content}</Text>
          {turn.role === 'tutor' ? (
            <Button
              label={t('talk.listen')}
              variant="ghost"
              onPress={() => speakText(turn.content, profile?.targetLang ?? 'en')}
            />
          ) : null}
        </View>
      ))}

      {conversation.hint ? (
        <Card>
          <Text style={styles.meta}>{t('talk.hint')}</Text>
          <Text style={styles.body}>{conversation.hint}</Text>
        </Card>
      ) : null}

      {conversation.done ? (
        <Card>
          <Text style={styles.title}>{t('talk.done')}</Text>
          {!conversation.report ? (
            <Button label={t('talk.report.show')} onPress={() => void conversation.loadReport()} />
          ) : (
            <View style={styles.report}>
              <Text style={styles.title}>{t('talk.report.title')}</Text>
              {conversation.report.corrections.length === 0 ? (
                <Text style={styles.body}>{t('talk.report.empty')}</Text>
              ) : (
                <View style={styles.report}>
                  <Text style={styles.meta}>{t('talk.report.corrections')}</Text>
                  {conversation.report.corrections.map((correction, index) => (
                    <Text key={`${correction.span}-${index}`} style={styles.body}>
                      {correction.span}: {correction.explanation}
                    </Text>
                  ))}
                </View>
              )}
              {conversation.report.focusPoints.length > 0 ? (
                <Text style={styles.meta}>
                  {t('talk.report.focus')}: {conversation.report.focusPoints.join(', ')}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                {t('talk.report.phrases')}: {conversation.report.usefulPhrases.join(' / ')}
              </Text>
            </View>
          )}
          <Button label={t('common.back')} onPress={() => router.back()} />
        </Card>
      ) : null}

      {conversation.error ? <Text style={styles.error}>{t('talk.error')}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: spacing.sm,
  },
  streaming: {
    gap: spacing.xs,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  bubble: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    maxWidth: '92%',
  },
  tutorBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: colors.surfaceMuted,
    alignSelf: 'flex-end',
  },
  role: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
  },
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
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  report: {
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
