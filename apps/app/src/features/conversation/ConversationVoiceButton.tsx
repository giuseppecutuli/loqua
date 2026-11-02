import { colors, spacing, typography } from '@loqua/ui';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { useProfile } from '../../providers/ProfileProvider';

async function readAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return globalThis.btoa(binary);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export interface ConversationVoiceButtonProps {
  readonly busy: boolean;
  readonly disabled: boolean;
  onSend(audioBase64: string, durationSec: number): void;
}

export function ConversationVoiceButton({
  busy,
  disabled,
  onSend,
}: ConversationVoiceButtonProps) {
  const { t, aiAllowed, voiceAllowed, grant } = useProfile();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canRecord = aiAllowed && voiceAllowed;

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
      onSend(await readAsBase64(uri), Math.max(1, Math.round(duration)));
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
