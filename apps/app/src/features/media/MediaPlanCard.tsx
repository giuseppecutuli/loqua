import { colors, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../components/Card';
import type { MediaPlanView } from '../../lib/api';
import { useProfile } from '../../providers/ProfileProvider';

export interface MediaPlanCardProps {
  readonly plan: MediaPlanView;
}

export function MediaPlanCard({ plan }: MediaPlanCardProps) {
  const { t } = useProfile();

  return (
    <Card>
      <Text style={styles.title}>{t('practice.media.plan.title')}</Text>
      <Text style={styles.meta}>
        {t('practice.media.plan.weekly', { minutes: plan.weeklyMinutes })}
      </Text>
      {plan.focus ? <Text style={styles.focus}>{plan.focus.title}</Text> : null}
      <Text style={styles.body}>
        {plan.focus ? t('practice.media.plan.continue') : t('practice.media.plan.empty')}
      </Text>
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
  focus: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '700',
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
});
