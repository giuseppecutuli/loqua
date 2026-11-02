import type { SkillProgress } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { SKILL_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

export interface SkillProgressListProps {
  readonly skills: readonly SkillProgress[];
}

export function SkillProgressList({ skills }: SkillProgressListProps) {
  const { t } = useProfile();

  if (skills.length === 0) {
    return (
      <Card>
        <Text style={styles.empty}>{t('progress.noData')}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>{t('progress.skills')}</Text>
      {skills.map((skill) => (
        <View key={skill.skill} style={styles.row}>
          <View style={styles.header}>
            <Text style={styles.name}>{t(SKILL_LABELS[skill.skill])}</Text>
            <Text style={styles.level}>{skill.range}</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(skill.mastery * 100)}%` }]} />
          </View>
          <Text style={styles.meta}>
            {t('progress.mastery')}: {Math.round(skill.mastery * 100)}% ·{' '}
            {t('progress.nObs', { count: skill.nObs })} · {Math.round(skill.confidence * 100)}%
          </Text>
        </View>
      ))}
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
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '600',
  },
  level: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '700',
  },
  bar: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
