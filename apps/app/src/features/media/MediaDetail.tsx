import type { TranslationKey } from '@loqua/ui';
import { colors, spacing, typography } from '@loqua/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import type {
  MediaGuideView,
  MediaProgressStatus,
  MediaProgressView,
  MediaRecommendationView,
  MediaReflectionView,
} from '../../lib/api';
import { MEDIA_KIND_LABELS } from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

const PROGRESS_LABELS: Record<MediaProgressStatus, TranslationKey> = {
  watching: 'practice.media.progress.watching',
  reading: 'practice.media.progress.watching',
  finished: 'practice.media.progress.finished',
  abandoned: 'practice.media.progress.abandoned',
};

export interface MediaDetailProps {
  readonly recommendation: MediaRecommendationView;
  readonly guide: MediaGuideView | null;
  readonly guideLoading: boolean;
  readonly progress: MediaProgressView | null;
  readonly busy: boolean;
  readonly reflection: MediaReflectionView | null;
  readonly onFinish: (mediaId: string) => Promise<void>;
  readonly onAbandon: (mediaId: string) => Promise<void>;
  readonly onReflect: (
    mediaId: string,
    input: { readonly text: string; readonly phrases: readonly string[] },
  ) => Promise<MediaReflectionView>;
}

export function MediaDetail({
  recommendation,
  guide,
  guideLoading,
  progress,
  busy,
  reflection,
  onFinish,
  onAbandon,
  onReflect,
}: MediaDetailProps) {
  const { t } = useProfile();
  const media = recommendation.media;
  const [text, setText] = useState('');
  const [phrases, setPhrases] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<MediaReflectionView | null>(reflection);

  useEffect(() => {
    setText('');
    setPhrases(['', '', '']);
    setError(false);
    setResult(reflection);
  }, [media.id, reflection]);

  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    setError(false);
    try {
      const submitted = await onReflect(media.id, {
        text: trimmed,
        phrases: phrases.map((value) => value.trim()).filter((value) => value.length > 0),
      });
      setResult(submitted);
      setText('');
      setPhrases(['', '', '']);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (guideLoading || guide === null) {
    return (
      <Card>
        <Text style={styles.title}>{t('practice.media.guide.title')}</Text>
        <Text style={styles.meta}>{t('practice.media.loading')}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>{t('practice.media.guide.title')}</Text>
        <Text style={styles.meta}>{media.title}</Text>
        <Text style={styles.meta}>{t(MEDIA_KIND_LABELS[media.kind])}</Text>
      </View>

      <GuideList title={t('practice.media.guide.before')} items={guide.before} />
      <GuideList title={t('practice.media.guide.during')} items={guide.during} />
      <GuideList title={t('practice.media.guide.after')} items={guide.after} />
      <GuideList title={t('practice.media.guide.phrases')} items={guide.functionalPhrases} />
      <GuideList title={t('practice.media.guide.questions')} items={guide.comprehensionPrompts} />

      {guide.reflectionTask.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('practice.media.guide.reflection')}</Text>
          <Text style={styles.body}>{guide.reflectionTask}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Text style={styles.meta}>
          {progress === null ? '' : t(PROGRESS_LABELS[progress.status])}
        </Text>
        <Button
          label={t('practice.media.progress.finish')}
          onPress={() => void onFinish(media.id)}
          disabled={busy || progress?.status === 'finished'}
        />
        <Button
          label={t('practice.media.progress.abandon')}
          variant="ghost"
          onPress={() => void onAbandon(media.id)}
          disabled={busy}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('practice.media.reflection.title')}</Text>
        <Text style={styles.meta}>{t('practice.media.reflection.hint')}</Text>
        <Field
          label={t('practice.media.reflection.title')}
          placeholder={t('practice.media.reflection.placeholder')}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={5}
        />
        <Text style={styles.meta}>
          {t('practice.media.reflection.words', { count: wordCount })}
        </Text>

        <Text style={styles.sectionTitle}>{t('practice.media.reflection.phrases')}</Text>
        {phrases.map((value, index) => (
          <Field
            key={index}
            label={t('practice.media.reflection.phrasePlaceholder')}
            placeholder={t('practice.media.reflection.phrasePlaceholder')}
            value={value}
            onChangeText={(next) =>
              setPhrases((current) =>
                current.map((entry, position) => (position === index ? next : entry)),
              )
            }
          />
        ))}

        {error ? <Text style={styles.error}>{t('errors.generic')}</Text> : null}

        <Button
          label={
            submitting || busy
              ? t('practice.media.reflection.submitting')
              : t('practice.media.reflection.submit')
          }
          onPress={() => void handleSubmit()}
          disabled={submitting || busy || text.trim().length === 0}
        />

        {result ? (
          <View style={styles.confirmation}>
            <Text style={styles.saved}>{t('practice.media.reflection.saved')}</Text>
            {result.xpAwarded > 0 ? (
              <Text style={styles.saved}>
                {t('practice.media.reflection.xp', { xp: result.xpAwarded })}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {result.reflection.countsAsProduction
                ? t('practice.media.reflection.production')
                : t('practice.media.reflection.notProduction')}
            </Text>
            {result.savedPhrases.map((phrase) => (
              <Text key={phrase.id} style={styles.meta}>
                {phrase.text}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function GuideList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <Text key={`${index}-${item}`} style={styles.body}>
          · {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
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
  actions: {
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  confirmation: {
    gap: spacing.xs,
  },
  saved: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: '600',
  },
});
