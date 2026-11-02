import type { LevelEventSummary } from '@loqua/core';
import { colors, typography, type TranslationKey } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../components/Card';
import { SKILL_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

const EVENT_LABELS: Record<LevelEventSummary['reason'], TranslationKey> = {
  placement: 'progress.event.placement',
  test_out: 'progress.event.test_out',
  remediation: 'progress.event.remediation',
  promotion: 'progress.event.promotion',
  challenge_pass: 'progress.event.challenge_pass',
  challenge_fail: 'progress.event.challenge_fail',
};

export interface LevelEventListProps {
  readonly events: readonly LevelEventSummary[];
}

export function LevelEventList({ events }: LevelEventListProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.title}>{t('progress.events')}</Text>
      {events.length === 0 ? (
        <Text style={styles.meta}>{t('progress.noEvents')}</Text>
      ) : (
        events.map((event) => (
          <Text key={event.id} style={styles.row}>
            {t(EVENT_LABELS[event.reason])}
            {event.skill ? ` · ${t(SKILL_LABELS[event.skill])}` : ''}
            {event.toLevel ? ` · ${event.toLevel}` : ''} ·{' '}
            {t.formatDate(new Date(event.createdAt), { day: 'numeric', month: 'short' })}
          </Text>
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
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
