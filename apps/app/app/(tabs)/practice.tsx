import { colors, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function PracticeScreen() {
  const { t } = useProfile();
  return (
    <Screen title={t('practice.title')}>
      <Card>
        <Text style={styles.body}>{t('practice.empty')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
