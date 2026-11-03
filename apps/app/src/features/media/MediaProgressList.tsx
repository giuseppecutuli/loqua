import type { TranslationKey } from '@loqua/ui';
import { colors, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import type {
  MediaPlanView,
  MediaProgressStatus,
  MediaProgressView,
  MediaRecommendationView,
} from '../../lib/api';
import { useProfile } from '../../providers/ProfileProvider';

const STATUS_LABELS: Record<MediaProgressStatus, TranslationKey> = {
  watching: 'practice.media.progress.watching',
  reading: 'practice.media.progress.watching',
  finished: 'practice.media.progress.finished',
  abandoned: 'practice.media.progress.abandoned',
};

export interface MediaProgressListProps {
  readonly progress: readonly MediaProgressView[];
  readonly recommendations: readonly MediaRecommendationView[];
  readonly plan: MediaPlanView | null;
}

export function MediaProgressList({ progress, recommendations, plan }: MediaProgressListProps) {
  const { t } = useProfile();

  if (progress.length === 0) return null;

  const titles = new Map<string, string>();
  for (const item of recommendations) {
    titles.set(item.media.id, item.media.title);
  }
  if (plan?.focus) {
    titles.set(plan.focus.id, plan.focus.title);
  }

  return (
    <Card>
      <Text style={styles.title}>{t('practice.media.progress.title')}</Text>
      {progress.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.mediaTitle}>{titles.get(item.mediaId) ?? item.mediaId}</Text>
          <Text style={styles.meta}>
            {t(STATUS_LABELS[item.status])} · {Math.round(item.progressPct)}%
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
  mediaTitle: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
