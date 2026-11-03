import { colors, radii, spacing, typography } from '@loqua/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { MediaRecommendationView } from '../../lib/api';
import { MEDIA_KIND_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

export interface MediaCardProps {
  readonly recommendation: MediaRecommendationView;
  readonly busy?: boolean;
  readonly onStart: (mediaId: string) => void;
  readonly onOpen: (mediaId: string) => void;
  readonly onReject: (mediaId: string) => void;
  readonly onTooHard: (mediaId: string) => void;
}

export function MediaCard({
  recommendation,
  busy,
  onStart,
  onOpen,
  onReject,
  onTooHard,
}: MediaCardProps) {
  const { t } = useProfile();
  const media = recommendation.media;

  const durationParts: string[] = [];
  if (media.durationMinutes !== undefined) {
    durationParts.push(t('practice.media.duration.minutes', { count: media.durationMinutes }));
  }
  if (media.episodeCount !== undefined) {
    durationParts.push(t('practice.media.duration.episodes', { count: media.episodeCount }));
  }
  if (media.episodeMinutes !== undefined) {
    durationParts.push(t('practice.media.duration.minutes', { count: media.episodeMinutes }));
  }
  if (media.pageCount !== undefined) {
    durationParts.push(t('practice.media.duration.pages', { count: media.pageCount }));
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{media.title}</Text>
          <Text style={styles.kind}>{t(MEDIA_KIND_LABELS[media.kind])}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLevel}>{media.difficultyBand}</Text>
          <Text style={styles.badgeLabel}>{t('practice.media.level')}</Text>
        </View>
      </View>

      {durationParts.length > 0 ? (
        <Text style={styles.meta}>{durationParts.join(' · ')}</Text>
      ) : null}

      {media.availabilityProviders.length > 0 ? (
        <Text style={styles.meta}>
          {t('practice.media.providers')}: {media.availabilityProviders.join(', ')}
        </Text>
      ) : null}

      {recommendation.reason.whyItFits.length > 0 ? (
        <Text style={styles.body}>{recommendation.reason.whyItFits}</Text>
      ) : null}
      {recommendation.reason.levelNote.length > 0 ? (
        <Text style={styles.meta}>{recommendation.reason.levelNote}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button label={t('practice.media.start')} onPress={() => onStart(media.id)} disabled={busy} />
        <Button
          label={t('practice.media.open')}
          variant="secondary"
          onPress={() => onOpen(media.id)}
          disabled={busy}
        />
        <Button
          label={t('practice.media.reject')}
          variant="ghost"
          onPress={() => onReject(media.id)}
          disabled={busy}
        />
        <Button
          label={t('practice.media.tooHard')}
          variant="ghost"
          onPress={() => onTooHard(media.id)}
          disabled={busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  kind: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  badge: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    gap: 2,
  },
  badgeLevel: {
    color: colors.primaryContrast,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    fontWeight: '700',
  },
  badgeLabel: {
    color: colors.primaryContrast,
    fontSize: 10,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
