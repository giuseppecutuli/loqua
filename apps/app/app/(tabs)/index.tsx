import type { SkillDomain } from '@loqua/core';
import { colors, spacing, typography, type TranslationKey } from '@loqua/ui';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { NotificationBanner } from '../../src/features/notifications/NotificationBanner';
import { useToday } from '../../src/features/today/useToday';
import { GOAL_LABELS } from '../../src/lib/labels';
import { useProfile } from '../../src/providers/ProfileProvider';

const QUEST_KEYS: Record<string, TranslationKey> = {
  'daily.streak': 'gamification.quest.streak',
  'daily.correct': 'gamification.quest.correct',
  'daily.fast': 'gamification.quest.fast',
  'weekly.consistency': 'gamification.mission.consistency',
};

const SKILL_KEYS: Record<SkillDomain, TranslationKey> = {
  grammar: 'progress.skill.grammar',
  vocabulary: 'progress.skill.vocabulary',
  listening: 'progress.skill.listening',
  speaking: 'progress.skill.speaking',
  reading: 'progress.skill.reading',
  writing: 'progress.skill.writing',
  pragmatics: 'progress.skill.pragmatics',
};

const BLOCK_KEYS: Record<string, TranslationKey> = {
  review: 'session.block.review',
  input: 'session.block.input',
  production: 'session.block.production',
};

export default function TodayScreen() {
  const { t, profile } = useProfile();
  const { gamification, planDay, busy, error, start } = useToday();

  async function onStart() {
    if (await start(profile?.dailyMinutes ?? null)) {
      router.push('/session');
    }
  }

  return (
    <Screen
      title={t('today.title')}
      subtitle={t.formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
    >
      <NotificationBanner />
      {gamification ? (
        <Card>
          <Text style={styles.title}>{t('today.level', { level: gamification.level })}</Text>
          <Text style={styles.body}>
            {t('today.streak', { days: gamification.streak.current })}
          </Text>
          <Text style={styles.meta}>
            {t('today.xp', { xp: gamification.xpToday })} / {gamification.totalXp} XP
          </Text>
          {gamification.quests.map((quest) => (
            <Text key={quest.id} style={quest.completed ? styles.done : styles.meta}>
              {t(QUEST_KEYS[quest.id] ?? 'gamification.quest.streak')} {quest.progress}/
              {quest.target}
            </Text>
          ))}
          <Text style={styles.meta}>
            {t(QUEST_KEYS[gamification.weeklyMission.id] ?? 'gamification.mission.consistency')}{' '}
            {gamification.weeklyMission.progress}/{gamification.weeklyMission.target}
          </Text>
        </Card>
      ) : null}

      {planDay ? (
        <Card>
          <Text style={styles.title}>
            {t('today.focus', { skill: t(SKILL_KEYS[planDay.focusSkill]) })}
          </Text>
          <Text style={styles.body}>
            {planDay.conceptIds.length + planDay.canDoIds.length > 0
              ? `${t('today.planReady', {
                  count: planDay.conceptIds.length + planDay.canDoIds.length,
                })} · `
              : ''}
            {t(BLOCK_KEYS[planDay.block] ?? 'session.block.input')}
          </Text>
          <Text style={styles.meta}>{t('common.minutes', { count: planDay.minutes })}</Text>
        </Card>
      ) : null}

      <Card>
        {planDay === null ? <Text style={styles.body}>{t('today.empty')}</Text> : null}
        {profile?.goal ? <Text style={styles.meta}>{t(GOAL_LABELS[profile.goal])}</Text> : null}
        {profile ? (
          <Text style={styles.meta}>{t('common.minutes', { count: profile.dailyMinutes })}</Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{t('session.error')}</Text> : null}
      <Button label={t('today.cta')} onPress={() => void onStart()} disabled={busy} />
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
