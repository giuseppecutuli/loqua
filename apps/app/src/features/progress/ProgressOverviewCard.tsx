import type { ProgressSummary } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../components/Card';
import { useProfile } from '../../providers/ProfileProvider';

export interface ProgressOverviewCardProps {
  readonly progress: ProgressSummary;
}

export function ProgressOverviewCard({ progress }: ProgressOverviewCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.label}>{t('progress.overall')}</Text>
      <Text style={styles.level}>{progress.overallRange ?? progress.overallLevel ?? '-'}</Text>
      <Text style={styles.meta}>
        {t('progress.confidence')}: {Math.round(progress.confidence * 100)}%
      </Text>
      {progress.latestAssessmentAt ? (
        <Text style={styles.meta}>
          {t('progress.lastAssessment')}:{' '}
          {t.formatDate(new Date(progress.latestAssessmentAt), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  level: {
    color: colors.text,
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: spacing.xxs,
  },
});
