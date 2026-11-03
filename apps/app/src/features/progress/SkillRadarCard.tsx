import type { SkillRadarEntry } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { SKILL_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

export interface SkillRadarCardProps {
  readonly radar: readonly SkillRadarEntry[];
}

export function SkillRadarCard({ radar }: SkillRadarCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.title}>{t('progress.radar')}</Text>
      {radar.length === 0 ? (
        <Text style={styles.empty}>{t('progress.noData')}</Text>
      ) : (
        radar.map((entry) => (
          <View key={entry.skill} style={styles.row}>
            <View style={styles.header}>
              <Text style={styles.name}>{t(SKILL_LABELS[entry.skill])}</Text>
              <Text style={styles.level}>{entry.level}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.round(entry.value * 100)}%` }]} />
            </View>
            <Text style={styles.meta}>
              {t('progress.mastery')}: {Math.round(entry.mastery * 100)}% ·{' '}
              {t('progress.confidence')}: {Math.round(entry.confidence * 100)}%
            </Text>
          </View>
        ))
      )}
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
