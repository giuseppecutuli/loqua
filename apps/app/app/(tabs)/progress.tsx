import { colors, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SKILL_LABELS } from '../../src/lib/labels';
import { useProfile } from '../../src/providers/ProfileProvider';
import { SKILL_DOMAINS } from '@loqua/core';

export default function ProgressScreen() {
  const { t, profile } = useProfile();
  return (
    <Screen title={t('progress.title')}>
      <Card>
        <Text style={styles.body}>{t('progress.empty')}</Text>
      </Card>
      {profile ? (
        <Card>
          {SKILL_DOMAINS.map((domain) => (
            <Text key={domain} style={styles.row}>
              {t(SKILL_LABELS[domain])}: {profile.selfAssessment[domain] ?? '—'}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  row: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
