import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { startSession } from '../../src/lib/api';
import { GOAL_LABELS } from '../../src/lib/labels';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function TodayScreen() {
  const { t, profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    setBusy(true);
    setError(false);
    try {
      await startSession();
      router.push('/session');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={t('today.title')}
      subtitle={t.formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
    >
      <Card>
        <Text style={styles.body}>{t('today.empty')}</Text>
        {profile?.goal ? <Text style={styles.meta}>{t(GOAL_LABELS[profile.goal])}</Text> : null}
        {profile ? (
          <Text style={styles.meta}>{t('common.minutes', { count: profile.dailyMinutes })}</Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{t('session.error')}</Text> : null}
      <Button label={t('today.cta')} onPress={() => void start()} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: spacing.xs,
  },
});
