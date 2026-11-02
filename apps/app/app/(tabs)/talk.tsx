import type { ConversationScenarioView } from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useConversationScenarios } from '../../src/features/conversation/useConversationScenarios';
import { startConversation } from '../../src/lib/api';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function TalkScreen() {
  const { t, aiAllowed, grant } = useProfile();
  const { loading, error, scenarios, reload } = useConversationScenarios();
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState(false);

  async function start(scenario: ConversationScenarioView) {
    setStarting(scenario.id);
    setStartError(false);
    try {
      const conversation = await startConversation(scenario.id);
      router.push({ pathname: '/conversation', params: { id: conversation.id } });
    } catch {
      setStartError(true);
    } finally {
      setStarting(null);
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

      {loading ? (
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>{t('talk.loading')}</Text>
          </View>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <Text style={styles.error}>{t('talk.error')}</Text>
          <Button label={t('common.retry')} onPress={reload} />
        </Card>
      ) : null}

      {!loading && !error && scenarios.length === 0 ? (
        <Card>
          <Text style={styles.body}>{t('talk.empty')}</Text>
        </Card>
      ) : null}

      {!loading && !error && scenarios.length > 0 ? (
        <Text style={styles.title}>{t('talk.scenarios')}</Text>
      ) : null}

      {!loading && !error
        ? scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <Text style={styles.title}>{scenario.title}</Text>
              <Text style={styles.meta}>
                {t('talk.level')}: {scenario.level} ? {scenario.register}
              </Text>
              <Text style={styles.body}>{scenario.setting}</Text>
              <Text style={styles.meta}>
                {t('talk.goal')}: {scenario.goal}
              </Text>
              <View style={styles.phrases}>
                {scenario.targetPhrases.slice(0, 3).map((phrase) => (
                  <Text key={phrase} style={styles.phrase}>
                    ?{phrase}?
                  </Text>
                ))}
              </View>
              <Button
                label={t('talk.start')}
                onPress={() => void start(scenario)}
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
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
