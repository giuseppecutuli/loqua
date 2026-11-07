import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { useTalk } from '../../src/features/conversation/useTalk';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function TalkScreen() {
  const { t, aiAllowed, grant } = useProfile();
  const { loading, error, scenarios, reload, starting, startError, start } = useTalk();

  async function onStart(scenarioId: string) {
    const conversationId = await start(scenarioId);
    if (conversationId) {
      router.push({ pathname: '/conversation', params: { id: conversationId } });
    }
  }

  return (
    <Screen title={t('talk.title')}>
      {!aiAllowed ? (
        <Card>
          <Text style={styles.body}>{t('talk.consentAi')}</Text>
          <Button
            label={t('talk.grantAi')}
            variant="secondary"
            onPress={() => void grant('ai_processing')}
          />
        </Card>
      ) : null}

      {loading ? <StateCard variant="loading" message={t('talk.loading')} /> : null}

      {error ? (
        <StateCard
          variant="error"
          message={t('talk.error')}
          actionLabel={t('common.retry')}
          onAction={reload}
        />
      ) : null}

      {!loading && !error && scenarios.length === 0 ? (
        <StateCard message={t('talk.empty')} />
      ) : null}

      {!loading && !error && scenarios.length > 0 ? (
        <Text style={styles.title}>{t('talk.scenarios')}</Text>
      ) : null}

      {!loading && !error
        ? scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <Text style={styles.title}>{scenario.title}</Text>
              <Text style={styles.meta}>
                {t('talk.level')}: {scenario.level} · {scenario.register}
              </Text>
              <Text style={styles.body}>{scenario.setting}</Text>
              <Text style={styles.meta}>
                {t('talk.goal')}: {scenario.goal}
              </Text>
              <View style={styles.phrases}>
                {scenario.targetPhrases.slice(0, 3).map((phrase) => (
                  <Text key={phrase} style={styles.phrase}>
                    “{phrase}”
                  </Text>
                ))}
              </View>
              <Button
                label={t('talk.start')}
                onPress={() => void onStart(scenario.id)}
                disabled={!aiAllowed || starting !== null}
              />
            </Card>
          ))
        : null}

      {startError ? <Text style={styles.error}>{t('talk.error')}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  phrase: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  phrases: {
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
