import { colors, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Field } from '../src/components/Field';
import { Screen } from '../src/components/Screen';
import { emailRedirectUrl } from '../src/lib/auth-link';
import { loadOrCreateIdentity } from '../src/lib/identity';
import { supabase, supabaseConfigured } from '../src/lib/supabase';
import { useProfile } from '../src/providers/ProfileProvider';

export default function LoginScreen() {
  const { t, identity, retry } = useProfile();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (identity && !identity.isAnonymous) {
      router.replace('/');
    }
  }, [identity]);

  async function sendLink() {
    const address = email.trim();
    if (!address.includes('@') || address.length < 5) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (!supabase) {
      setError(t('auth.notConfigured'));
      return;
    }

    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: emailRedirectUrl() },
    });
    if (sendError) {
      setError(t('errors.generic'));
      return;
    }
    setSent(true);
  }

  return (
    <Screen
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInHint')}
      footer={
        <Button
          label={t('common.back')}
          variant="ghost"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/onboarding');
          }}
        />
      }
    >
      {!supabaseConfigured ? (
        <Card>
          <Text style={styles.error}>{t('auth.notConfigured')}</Text>
        </Card>
      ) : sent ? (
        <Card>
          <Text style={styles.body}>{t('auth.checkEmail')}</Text>
          <Button
            label={t('auth.sendLink')}
            variant="secondary"
            onPress={() => {
              setSent(false);
            }}
          />
        </Card>
      ) : (
        <Card>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={t('auth.sendLink')} onPress={() => void sendLink()} />
          <Button
            label={t('auth.continueAnonymous')}
            variant="ghost"
            onPress={() => {
              void (async () => {
                await loadOrCreateIdentity().catch(() => undefined);
                retry();
                router.replace('/onboarding');
              })();
            }}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginTop: spacing.xs,
  },
});
