import {
  CEFR_LEVELS,
  GOALS,
  SKILL_DOMAINS,
  type CefrLevel,
  type Goal,
  type SkillDomain,
} from '@loqua/core';
import { colors, layout, radii, spacing, typography } from '@loqua/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Screen } from '../src/components/Screen';
import { GOAL_LABELS, SKILL_LABELS } from '../src/lib/labels';
import { useProfile } from '../src/providers/ProfileProvider';

const MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
const INTEREST_OPTIONS = [
  { id: 'technology', labelKey: 'onboarding.interests.option.technology' },
  { id: 'travel', labelKey: 'onboarding.interests.option.travel' },
  { id: 'films', labelKey: 'onboarding.interests.option.films' },
  { id: 'series', labelKey: 'onboarding.interests.option.series' },
  { id: 'music', labelKey: 'onboarding.interests.option.music' },
  { id: 'sport', labelKey: 'onboarding.interests.option.sport' },
  { id: 'food', labelKey: 'onboarding.interests.option.food' },
  { id: 'work', labelKey: 'onboarding.interests.option.work' },
  { id: 'reading', labelKey: 'onboarding.interests.option.reading' },
  { id: 'gaming', labelKey: 'onboarding.interests.option.gaming' },
  { id: 'social', labelKey: 'onboarding.interests.option.social' },
  { id: 'nature', labelKey: 'onboarding.interests.option.nature' },
] as const;
const PRESET_IDS: ReadonlySet<string> = new Set(INTEREST_OPTIONS.map((option) => option.id));
const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { t, saveOnboarding, grantMany } = useProfile();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [selfAssessment, setSelfAssessment] = useState<Partial<Record<SkillDomain, CefrLevel>>>({});
  const [interests, setInterests] = useState<readonly string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addInterest() {
    const value = interestInput.trim();
    if (value.length === 0) return;
    if (interests.some((interest) => interest.toLowerCase() === value.toLowerCase())) {
      setInterestInput('');
      return;
    }
    if (interests.length >= 12) return;
    setInterests([...interests, value]);
    setInterestInput('');
  }

  function toggleInterest(id: string) {
    setInterests((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : current.length >= 12
          ? current
          : [...current, id],
    );
    setError(null);
  }

  async function finish() {
    if (!goal) return;
    if (interests.length === 0) {
      setError(t('onboarding.interests.required'));
      return;
    }
    if (!acceptedTerms) {
      setError(t('onboarding.consent.required'));
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
    const result = await saveOnboarding({
      goal,
      dailyMinutes: minutes,
      timezone,
      interests: [...interests],
      selfAssessment,
      streakMode: 'flexible',
    });

    if (!result.ok) {
      setError(t('errors.generic'));
      return;
    }

    await grantMany(['terms', 'privacy']);
    router.replace('/placement');
  }

  async function next() {
    setError(null);
    if (step === 0 && !goal) {
      setError(t('errors.generic'));
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      return;
    }
    await finish();
  }

  return (
    <Screen
      title={t('onboarding.title')}
      subtitle={t('onboarding.subtitle')}
      footer={
        <View style={styles.footer}>
          {step > 0 ? (
            <Button
              label={t('common.back')}
              variant="ghost"
              onPress={() => {
                setError(null);
                setStep(step - 1);
              }}
            />
          ) : null}
          <View style={styles.footerSpacer} />
          <Button
            label={step === TOTAL_STEPS - 1 ? t('onboarding.finish') : t('common.continue')}
            onPress={next}
            disabled={step === 0 && !goal}
          />
        </View>
      }
    >
      <Text style={styles.progress}>
        {t('onboarding.progress', { current: step + 1, total: TOTAL_STEPS })}
      </Text>

      <Button label={t('auth.haveAccount')} variant="ghost" onPress={() => router.push('/login')} />

      {step === 0 ? (
        <Card>
          <Text style={styles.question}>{t('onboarding.goal.title')}</Text>
          <View style={styles.wrap}>
            {GOALS.map((option) => (
              <Chip
                key={option}
                label={t(GOAL_LABELS[option])}
                selected={goal === option}
                onPress={() => setGoal(option)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <Text style={styles.question}>{t('onboarding.time.title')}</Text>
          <Text style={styles.hint}>{t('onboarding.time.hint')}</Text>
          <View style={styles.wrap}>
            {MINUTE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t('common.minutes', { count: option })}
                selected={minutes === option}
                onPress={() => setMinutes(option)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Text style={styles.question}>{t('onboarding.self.title')}</Text>
          <Text style={styles.hint}>{t('onboarding.self.hint')}</Text>
          {SKILL_DOMAINS.map((domain) => (
            <View key={domain} style={styles.skillRow}>
              <Text style={styles.skillLabel}>{t(SKILL_LABELS[domain])}</Text>
              <View style={styles.wrap}>
                {CEFR_LEVELS.map((level) => (
                  <Chip
                    key={level}
                    label={level}
                    selected={selfAssessment[domain] === level}
                    onPress={() =>
                      setSelfAssessment((current) => ({ ...current, [domain]: level }))
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <Text style={styles.question}>{t('onboarding.interests.title')}</Text>
          <Text style={styles.hint}>{t('onboarding.interests.hint')}</Text>
          <View style={styles.wrap}>
            {INTEREST_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={t(option.labelKey)}
                selected={interests.includes(option.id)}
                onPress={() => toggleInterest(option.id)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t('onboarding.interests.multiHint')}</Text>
          <View style={styles.interestInput}>
            <TextInput
              value={interestInput}
              onChangeText={setInterestInput}
              onSubmitEditing={addInterest}
              placeholder={t('onboarding.interests.placeholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              returnKeyType="done"
            />
            <Button
              label={t('onboarding.interests.add')}
              variant="secondary"
              onPress={addInterest}
            />
          </View>
          {interests.some((interest) => !PRESET_IDS.has(interest)) ? (
            <View style={styles.wrap}>
              {interests
                .filter((interest) => !PRESET_IDS.has(interest))
                .map((interest) => (
                  <Chip
                    key={interest}
                    label={interest}
                    selected
                    onPress={() => setInterests(interests.filter((entry) => entry !== interest))}
                  />
                ))}
            </View>
          ) : null}
          <View style={styles.consentRow}>
            <Switch
              value={acceptedTerms}
              onValueChange={setAcceptedTerms}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
            <Text style={styles.consentText}>{t('onboarding.consent.termsPrivacy')}</Text>
          </View>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
  },
  question: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skillLabel: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '600',
  },
  interestInput: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  consentText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  footerSpacer: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
