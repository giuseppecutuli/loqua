import { colors, spacing, typography } from '@loqua/ui';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { MediaCard } from '../../src/features/media/MediaCard';
import { MediaDetail } from '../../src/features/media/MediaDetail';
import { MediaPlanCard } from '../../src/features/media/MediaPlanCard';
import { MediaProgressList } from '../../src/features/media/MediaProgressList';
import { TasteForm } from '../../src/features/media/TasteForm';
import { useMedia } from '../../src/features/media/useMedia';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function PracticeScreen() {
  const { t } = useProfile();
  const media = useMedia();
  const [showTaste, setShowTaste] = useState(false);

  const title = t('practice.title');
  const subtitle = t('practice.immersion');

  if (media.loading) {
    return (
      <Screen title={title} subtitle={subtitle}>
        <StateCard variant="loading" message={t('practice.media.loading')} />
      </Screen>
    );
  }

  if (media.error) {
    return (
      <Screen title={title} subtitle={subtitle}>
        <StateCard
          variant="error"
          message={t('practice.media.error')}
          actionLabel={t('common.retry')}
          onAction={media.reload}
        />
      </Screen>
    );
  }

  if (media.taste === null) {
    return (
      <Screen title={title} subtitle={subtitle}>
        <TasteForm
          initial={null}
          onSave={media.saveTaste}
          onReset={media.resetTaste}
          busy={media.busy}
        />
        <Text style={styles.meta}>{t('practice.media.consent')}</Text>
      </Screen>
    );
  }

  return (
    <Screen title={title} subtitle={subtitle}>
      {media.plan ? <MediaPlanCard plan={media.plan} /> : null}

      <Button
        label={showTaste ? t('common.cancel') : t('practice.media.taste.edit')}
        variant="secondary"
        onPress={() => setShowTaste((current) => !current)}
      />
      {showTaste ? (
        <TasteForm
          initial={media.taste}
          onSave={media.saveTaste}
          onReset={async () => {
            await media.resetTaste();
            setShowTaste(false);
          }}
          busy={media.busy}
        />
      ) : null}

      <Text style={styles.sectionTitle}>{t('practice.media.recs')}</Text>
      {media.recommendations.length === 0 ? (
        <StateCard message={t('practice.media.empty')} />
      ) : (
        media.recommendations.map((recommendation) => (
          <MediaCard
            key={recommendation.recommendationId}
            recommendation={recommendation}
            busy={media.busy}
            onStart={(mediaId) => void media.startGuide(mediaId)}
            onOpen={(mediaId) => void media.startGuide(mediaId)}
            onReject={(mediaId) => void media.reject(mediaId)}
            onTooHard={(mediaId) => void media.tooHard(mediaId)}
          />
        ))
      )}

      <MediaProgressList
        progress={media.progress}
        recommendations={media.recommendations}
        plan={media.plan}
      />

      {media.selected ? (
        <MediaDetail
          recommendation={media.selected}
          guide={media.guide}
          guideLoading={media.guideLoading}
          progress={media.selectedProgress}
          busy={media.busy}
          reflection={media.reflection}
          onFinish={media.finish}
          onAbandon={media.abandon}
          onReflect={media.reflect}
        />
      ) : null}

      <Text style={styles.meta}>{t('practice.media.consent')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    paddingHorizontal: spacing.xs,
  },
});
