import type { PlacementResult } from '@loqua/core';
import { colors, typography } from '@loqua/ui';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SKILL_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

export interface PlacementResultCardProps {
  readonly result: PlacementResult;
  onContinue(): void;
  onRedo(): void;
}

export function PlacementResultCard({ result, onContinue, onRedo }: PlacementResultCardProps) {
  const { t } = useProfile();
  const decisions = result.decisions;
  const remediationSkills = decisions?.remediationSkills ?? [];
  const testOutCount = decisions?.testOutConcepts.length ?? 0;
  const challengeLevel = decisions?.challengeLevel ?? null;

  return (
    <>
      <Card>
        <Text testID="placement-level" style={styles.level}>
          {result.overallRange ?? result.overallLevel ?? '-'}
        </Text>
        <Text style={styles.body}>
          {t('placement.result.overall')}: {result.overallLevel ?? '-'}
        </Text>
        <Text style={styles.meta}>
          {t('placement.result.range')}: {result.overallRange ?? '-'}
        </Text>
        <Text style={styles.meta}>
          {t('placement.result.confidence')}: {Math.round(result.confidence * 100)}%
        </Text>
      </Card>

      {result.priorities.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('placement.result.priorities')}</Text>
          {result.priorities.map((priority) => (
            <Text key={priority.skill} style={styles.body}>
              {t('placement.result.priority', {
                skill: t(SKILL_LABELS[priority.skill]),
                level: priority.level,
              })}
            </Text>
          ))}
        </Card>
      ) : null}

      {result.strengths.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('placement.result.strengths')}</Text>
          {result.strengths.map((strength) => (
            <Text key={strength.skill} style={styles.body}>
              {t('placement.result.strength', {
                skill: t(SKILL_LABELS[strength.skill]),
                level: strength.level,
              })}
            </Text>
          ))}
        </Card>
      ) : null}

      {decisions ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('placement.result.next')}</Text>
          {testOutCount > 0 ? (
            <Text style={styles.body}>
              {t('placement.result.testOutCount', { count: testOutCount })}
            </Text>
          ) : null}
          {remediationSkills.length > 0 ? (
            <Text style={styles.body}>
              {t('placement.result.remediationSkills', {
                skills: remediationSkills.map((entry) => t(SKILL_LABELS[entry.skill])).join(', '),
              })}
            </Text>
          ) : null}
          <Text style={challengeLevel ? styles.body : styles.meta}>
            {challengeLevel
              ? t('placement.result.challengeLevel', { level: challengeLevel })
              : t('placement.result.consolidateFirst')}
          </Text>
        </Card>
      ) : null}

      {result.writing ? (
        <Card>
          <Text style={styles.sectionTitle}>
            {t('placement.result.writing', { level: result.writing.level })}
          </Text>
          <Text style={styles.meta}>{result.writing.range}</Text>
          {result.writing.priorities[0] ? (
            <Text style={styles.body}>
              {t('placement.result.writingFeedback', {
                text: result.writing.priorities[0],
              })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {result.speaking ? (
        <Card>
          <Text style={styles.sectionTitle}>
            {t('placement.result.speaking', { level: result.speaking.level })}
          </Text>
          <Text style={styles.meta}>{result.speaking.range}</Text>
          {result.speaking.priorities[0] ? (
            <Text style={styles.body}>
              {t('placement.result.speakingFeedback', {
                text: result.speaking.priorities[0],
              })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {result.unmeasured.length > 0 ? (
        <Card>
          <Text style={styles.meta}>
            {t('placement.result.unmeasured', {
              skills: result.unmeasured.map((skill) => t(SKILL_LABELS[skill])).join(', '),
            })}
          </Text>
        </Card>
      ) : null}

      <Button label={t('placement.result.continue')} onPress={onContinue} />
      <Button label={t('placement.result.redo')} variant="ghost" onPress={onRedo} />
    </>
  );
}

const styles = StyleSheet.create({
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
  level: {
    color: colors.text,
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
});
