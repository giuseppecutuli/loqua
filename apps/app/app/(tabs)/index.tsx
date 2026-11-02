import { colors, spacing, typography, type TranslationKey } from '@loqua/ui';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { fetchGamification, startSession } from '../../src/lib/api';
import { GOAL_LABELS } from '../../src/lib/labels';
import { useProfile } from '../../src/providers/ProfileProvider';
import type { GamificationSnapshot } from '@loqua/core';

const QUEST_KEYS: Record<string, TranslationKey> = {
  'daily.streak': 'gamification.quest.streak',
  'daily.correct': 'gamification.quest.correct',
  'daily.fast': 'gamification.quest.fast',
  'weekly.consistency': 'gamification.mission.consistency',
};

export default function TodayScreen() {
  const { t, profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [gamification, setGamification] = useState<GamificationSnapshot | null>(null);

  useEffect(() => {
    void fetchGamification()
      .then(setGamification)
      .catch(() => setGamification(null));
  }, []);

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
      {gamification ? (
        <Card>
          <Text style={styles.title}>
            {t('today.level', { level: gamification.level })}
          </Text>
          <Text style={styles.body}>
            {t('today.streak', { days: gamification.streak.current })}
          </Text>
          <Text style={styles.meta}>
            {t('today.xp', { xp: gamification.xpToday })} / {gamification.totalXp} XP
          </Text>
          {gamification.quests.map((quest) => (
            <Text key={quest.id} style={quest.completed ? styles.done : styles.meta}>
              {t(QUEST_KEYS[quest.id] ?? 'gamification.quest.streak')} {quest.progress}/{quest.target}
            </Text>
          ))}
          <Text style={styles.meta}>
            {t(QUEST_KEYS[gamification.weeklyMission.id] ?? 'gamification.mission.consistency')}{' '}
            {gamification.weeklyMission.progress}/{gamification.weeklyMission.target}
          </Text>
        </Card>
      ) : null}

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
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    fontWeight: typography.subtitle.fontWeight,
  },
  done: {
    color: colors.success,
    fontSize: typography.body.fontSize,
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
