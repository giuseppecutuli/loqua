import type { SpeakingTask } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readAudioAsBase64 } from '../../lib/audio';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface PlacementSpeakingCardProps {
  readonly task: SpeakingTask;
  readonly busy: boolean;
  readonly error: boolean;
  onSubmit(audioBase64: string, durationSec: number): void;
  onSkip(): void;
}

export function PlacementSpeakingCard({
  task,
  busy,
  error,
  onSubmit,
  onSkip,
}: PlacementSpeakingCardProps) {
  const { t, aiAllowed, voiceAllowed, grant } = useProfile();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [localError, setLocalError] = useState<'too_short' | 'mic_denied' | null>(null);

  const canRecord = aiAllowed && voiceAllowed;

  useEffect(() => {
    setPhase('idle');
    setUri(null);
    setDuration(0);
    setLocalError(null);
  }, [task.id]);

  useEffect(() => {
    if (phase === 'recording' && recorderState.durationMillis >= task.maxSeconds * 1000) {
      void stop();
    }
  });

  async function start() {
    setLocalError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setLocalError('mic_denied');
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
      setLocalError('mic_denied');
    }
  }

  async function stop() {
    if (phase !== 'recording') return;
    const recordedMs = Math.max(recorderState.durationMillis, recorder.currentTime * 1000);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setDuration(recordedMs / 1000);
    setUri(recorder.uri);
    setPhase('recorded');
  }

  async function submit() {
    if (!uri) return;
    if (duration < task.minSeconds) {
      setLocalError('too_short');
      return;
    }
    setLocalError(null);
    try {
      onSubmit(await readAudioAsBase64(uri), Math.round(duration));
    } catch {
      setLocalError('too_short');
    }
  }

  return (
    <Card>
      <Text style={styles.title}>{t('placement.speaking.title')}</Text>
      <Text style={styles.body}>{task.prompt}</Text>
      <Text style={styles.hint}>{t('placement.speaking.hint')}</Text>
      <Text style={styles.meta}>
        {t('placement.speaking.maxSeconds', { seconds: task.maxSeconds })}
      </Text>

      {!canRecord ? (
        <View style={styles.consent}>
          <Text style={styles.body}>{t('placement.speaking.consent')}</Text>
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
      ) : null}

      {phase === 'recording' ? (
        <Text style={styles.recording}>
          {Math.round(recorderState.durationMillis / 1000)}s
        </Text>
      ) : null}

      {phase === 'recorded' ? (
        <Text style={styles.meta}>
          {t('placement.speaking.recorded')} - {Math.round(duration)}s
        </Text>
      ) : null}

      {localError === 'too_short' ? (
        <Text style={styles.error}>
          {t('placement.speaking.tooShort', { seconds: task.minSeconds })}
        </Text>
      ) : null}
      {localError === 'mic_denied' ? (
        <Text style={styles.error}>{t('placement.speaking.micDenied')}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{t('placement.error')}</Text> : null}
      {busy ? <Text style={styles.hint}>{t('placement.speaking.evaluating')}</Text> : null}

      {phase === 'idle' ? (
        <Button label={t('placement.speaking.record')} onPress={() => void start()} disabled={!canRecord || busy} />
      ) : null}
      {phase === 'recording' ? (
        <Button label={t('placement.speaking.stop')} onPress={() => void stop()} disabled={busy} />
      ) : null}
      {phase === 'recorded' ? (
        <>
          <Button
            label={t('placement.speaking.submit')}
            onPress={() => void submit()}
            disabled={busy}
          />
          <Button
            label={t('placement.speaking.rerecord')}
            variant="secondary"
            onPress={() => void start()}
            disabled={busy}
          />
        </>
      ) : null}
      <Button
        label={t('placement.speaking.skip')}
        variant="ghost"
        onPress={onSkip}
        disabled={busy || phase === 'recording'}
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
  recording: {
    color: colors.danger,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
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
