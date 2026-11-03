import type { CefrTrendPoint } from '@loqua/core';
import { colors, radii, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface CefrTrendCardProps {
  readonly trend: readonly CefrTrendPoint[];
}

function toPercent(value: number): number {
  return ((value - 1) / 4) * 100;
}

export function CefrTrendCard({ trend }: CefrTrendCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.title}>{t('progress.trend')}</Text>
      {trend.length === 0 ? (
        <Text style={styles.empty}>{t('progress.trend.empty')}</Text>
      ) : (
        trend.map((point) => {
          const lower = toPercent(point.lower);
          const upper = toPercent(point.upper);
          const marker = toPercent(point.value);
          return (
            <View key={point.month} style={styles.row}>
              <View style={styles.header}>
                <Text style={styles.month}>
                  {t.formatDate(new Date(`${point.month}-01T12:00:00Z`), {
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.level}>{point.level}</Text>
              </View>
              <View
                accessibilityLabel={`${point.level} ${Math.round(point.confidence * 100)}%`}
                style={styles.track}
              >
                <View
                  style={[
                    styles.band,
                    { left: `${lower}%`, width: `${Math.max(0, upper - lower)}%` },
                  ]}
                />
                <View style={[styles.marker, { left: `${marker}%` }]} />
              </View>
              <Text style={styles.meta}>
                {t('progress.confidence')}: {Math.round(point.confidence * 100)}%
              </Text>
            </View>
          );
        })
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
  month: {
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
  track: {
    position: 'relative',
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
    opacity: 0.35,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    borderRadius: radii.sm,
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
