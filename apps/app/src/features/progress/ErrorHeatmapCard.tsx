import type { ErrorHeatmapEntry } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface ErrorHeatmapCardProps {
  readonly errors: readonly ErrorHeatmapEntry[];
}

export function ErrorHeatmapCard({ errors }: ErrorHeatmapCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.title}>{t('progress.errorHeatmap')}</Text>
      {errors.length === 0 ? (
        <Text style={styles.empty}>{t('progress.errorHeatmap.empty')}</Text>
      ) : (
        errors.map((entry) => (
          <View key={entry.key} style={styles.row}>
            <View style={styles.header}>
              <Text style={styles.label}>{entry.ruleId ?? t('progress.error.unknownType')}</Text>
              <Text style={styles.count}>{t('progress.error.count', { count: entry.count })}</Text>
            </View>
            {entry.errorType ? <Text style={styles.meta}>{entry.errorType}</Text> : null}
            <Text style={styles.meta}>
              {t('progress.error.lastSeen', {
                date: t.formatDate(new Date(entry.lastSeenAt), { day: 'numeric', month: 'short' }),
              })}
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
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '600',
    flexShrink: 1,
  },
  count: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '700',
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
