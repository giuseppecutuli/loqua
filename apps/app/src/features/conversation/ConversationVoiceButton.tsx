import { colors, spacing, typography } from '@loqua/ui';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { readAudioAsBase64 } from '../../lib/audio';
import { Button } from '../../components/Button';
import { useProfile } from '../../providers/ProfileProvider';

export interface ConversationVoiceButtonProps {
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly language: string;
  onSend(audioBase64: string, durationSec: number): void;
  onText(text: string): void;
}

export function ConversationVoiceButton({
  busy,
  disabled,
  language,
  onSend,
  onText,
}: ConversationVoiceButtonProps) {
  const { t, aiAllowed, voiceAllowed, grant } = useProfile();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canRecord = aiAllowed && voiceAllowed;
  const webSpeechSupported =
    Platform.OS === 'web' &&
    (typeof globalThis === 'object' &&
      ('SpeechRecognition' in globalThis || 'webkitSpeechRecognition' in globalThis));

  function startWebSpeech() {
    const constructor =
      Reflect.get(globalThis, 'SpeechRecognition') ??
      Reflect.get(globalThis, 'webkitSpeechRecognition');
    if (typeof constructor !== 'function') return;
    const recognition = new constructor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) onText(transcript.trim());
    };
    recognition.onerror = () => setError(t('talk.voice.error'));
    recognition.start();
  }

  useEffect(() => {
    if (phase === 'recording' && state.durationMillis >= 30_000) void stop();
  });

  async function start() {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t('talk.voice.error'));
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setUri(null);
      setDuration(0);
      setPhase('recording');
    } catch {
      setError(t('talk.voice.error'));
    }
  }

  async function stop() {
    if (phase !== 'recording') return;
    const recordedMs = Math.max(state.durationMillis, recorder.currentTime * 1000);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setDuration(recordedMs / 1000);
    setUri(recorder.uri);
    setPhase('recorded');
  }

  async function send() {
    if (!uri) return;
    try {
      onSend(await readAudioAsBase64(uri), Math.max(1, Math.round(duration)));
      setPhase('idle');
      setUri(null);
      setDuration(0);
    } catch {
      setError(t('talk.voice.error'));
    }
  }

  if (!canRecord) {
    return (
      <View style={styles.consent}>
        <Text style={styles.hint}>{t('talk.voice.consent')}</Text>
        {!aiAllowed ? (
          <Button
            label={t('placement.speaking.grantAi')}
            variant="secondary"
            onPress={() => void grant('ai_processing')}
          />
        ) : null}
        {!voiceAllowed ? (
          <Button
            label={t('placement.speaking.grantVoice')}
            variant="secondary"
            onPress={() => void grant('voice')}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {phase === 'idle' ? (
        <Button
          label={t('talk.voice.record')}
          variant="secondary"
          disabled={busy || disabled}
          onPress={() => void start()}
        />
      ) : null}
      {webSpeechSupported && phase === 'idle' ? (
        <Button
          label={t('talk.voice.browser')}
          variant="ghost"
          disabled={busy || disabled}
          onPress={startWebSpeech}
        />
      ) : null}
      {phase === 'recording' ? (
        <Button
          label={t('talk.voice.stop')}
          onPress={() => void stop()}
          disabled={busy}
        />
      ) : null}
      {phase === 'recorded' ? (
        <>
          <Text style={styles.hint}>{t('talk.voice.ready', { seconds: Math.round(duration) })}</Text>
          <Button
            label={t('talk.voice.send')}
            onPress={() => void send()}
            disabled={busy || disabled}
          />
          <Button
            label={t('talk.voice.retry')}
            variant="ghost"
            onPress={() => void start()}
            disabled={busy}
          />
        </>
      ) : null}
      {phase === 'recording' ? (
        <Text style={styles.hint}>{Math.round(state.durationMillis / 1000)}s</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  consent: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceMuted },
  hint: { color: colors.textMuted, fontSize: typography.caption.fontSize },
  error: { color: colors.danger, fontSize: typography.caption.fontSize },
});
