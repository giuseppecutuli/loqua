import { colors, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function TalkScreen() {
  const { t, voiceAllowed, grantMany } = useProfile();

  if (!voiceAllowed) {
    return (
      <Screen title={t('talk.title')}>
        <Card>
          <Text style={styles.body}>{t('talk.consentRequired')}</Text>
          <Button
            label={t('settings.consent.voice')}
            onPress={() => grantMany(['ai_processing', 'voice'])}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('talk.title')}>
      <Card>
        <Text style={styles.body}>{t('talk.empty')}</Text>
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
