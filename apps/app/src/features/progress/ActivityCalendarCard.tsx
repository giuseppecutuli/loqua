import type { WeekInsights } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface ActivityCalendarCardProps {
  readonly heatmap: WeekInsights['heatmap'];
}

export function ActivityCalendarCard({ heatmap }: ActivityCalendarCardProps) {
  const { t } = useProfile();
  const max = Math.max(1, ...heatmap.map((day) => day.attempts));

  return (
    <Card>
      <Text style={styles.title}>{t('progress.calendar')}</Text>
      <View style={styles.grid}>
        {heatmap.map((day) => (
          <View
            key={day.date}
            accessibilityLabel={`${day.date}: ${day.attempts}`}
            style={[
              styles.cell,
              {
                opacity: day.attempts === 0 ? 0.15 : 0.35 + (day.attempts / max) * 0.65,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.meta}>{t('progress.week.heatmap')}</Text>
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
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
});
