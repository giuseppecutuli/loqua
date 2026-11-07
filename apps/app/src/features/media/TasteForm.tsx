import {
  DIFFICULTY_TOLERANCES,
  MEDIA_GENRES,
  MEDIA_KINDS,
  MEDIA_THEMES,
  SUBTITLE_PREFS,
  type DifficultyTolerance,
  type MediaKind,
  type SubtitlePref,
  type TasteProfile,
} from '@loqua/core';
import { colors, spacing, typography } from '@loqua/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import type { MediaTaste } from './types';
import {
  MEDIA_DIFFICULTY_LABELS,
  MEDIA_DISLIKE_LABELS,
  MEDIA_DISLIKES,
  MEDIA_GENRE_LABELS,
  MEDIA_KIND_LABELS,
  MEDIA_REGION_LABELS,
  MEDIA_REGIONS,
  MEDIA_SUBTITLE_LABELS,
  MEDIA_THEME_LABELS,
  MEDIA_WEEKLY_MINUTES,
  type MediaRegion,
} from '../../lib/labels';
import { useProfile } from '../../providers/ProfileProvider';

type FormStatus = 'idle' | 'saving' | 'saved' | 'invalid' | 'error';

export interface TasteFormProps {
  readonly initial: MediaTaste | null;
  readonly onSave: (taste: TasteProfile) => Promise<void>;
  readonly onReset: () => Promise<void>;
  readonly busy: boolean;
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function isMediaRegion(value: string | undefined): value is MediaRegion {
  return (
    value === 'IT' ||
    value === 'US' ||
    value === 'GB' ||
    value === 'FR' ||
    value === 'DE' ||
    value === 'ES'
  );
}

export function TasteForm({ initial, onSave, onReset, busy }: TasteFormProps) {
  const { t } = useProfile();
  const [formats, setFormats] = useState<MediaKind[]>(
    initial ? [...initial.formats] : [...MEDIA_KINDS],
  );
  const [genres, setGenres] = useState<string[]>(initial ? [...initial.genres] : []);
  const [themes, setThemes] = useState<string[]>(initial ? [...initial.themes] : []);
  const [disliked, setDisliked] = useState<string[]>(initial ? [...initial.disliked] : []);
  const [difficulty, setDifficulty] = useState<DifficultyTolerance>(
    initial?.difficultyTolerance ?? 'balanced',
  );
  const [subtitles, setSubtitles] = useState<SubtitlePref>(initial?.subtitlePref ?? 'target');
  const [weeklyMinutes, setWeeklyMinutes] = useState<number>(initial?.weeklyMinutes ?? 120);
  const initialRegion = initial?.region;
  const [region, setRegion] = useState<MediaRegion>(
    isMediaRegion(initialRegion) ? initialRegion : 'IT',
  );
  const [status, setStatus] = useState<FormStatus>('idle');

  const buildTaste = (): TasteProfile => ({
    formats,
    genres,
    themes,
    disliked,
    difficultyTolerance: difficulty,
    subtitlePref: subtitles,
    accents: initial?.accents ?? ['mixed'],
    region,
    weeklyMinutes,
    maxAgeRating: initial?.maxAgeRating ?? null,
    genreWeights: initial?.genreWeights ?? {},
    themeWeights: initial?.themeWeights ?? {},
    coverageOffset: initial?.coverageOffset ?? 0,
  });

  const handleSave = async () => {
    if (formats.length === 0 || genres.length === 0) {
      setStatus('invalid');
      return;
    }
    setStatus('saving');
    try {
      await onSave(buildTaste());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const handleReset = async () => {
    setStatus('idle');
    try {
      await onReset();
    } catch {
      setStatus('error');
    }
  };

  return (
    <Card>
      <Text style={styles.title}>{t('practice.media.taste.title')}</Text>

      <Text style={styles.label}>{t('practice.media.taste.formats')}</Text>
      <View style={styles.chips}>
        {MEDIA_KINDS.map((kind) => (
          <Chip
            key={kind}
            label={t(MEDIA_KIND_LABELS[kind])}
            selected={formats.includes(kind)}
            onPress={() => setFormats((current) => toggleValue(current, kind))}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.genres')}</Text>
      <View style={styles.chips}>
        {MEDIA_GENRES.map((genre) => (
          <Chip
            key={genre}
            label={t(MEDIA_GENRE_LABELS[genre])}
            selected={genres.includes(genre)}
            onPress={() => setGenres((current) => toggleValue(current, genre))}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.themes')}</Text>
      <View style={styles.chips}>
        {MEDIA_THEMES.map((theme) => (
          <Chip
            key={theme}
            label={t(MEDIA_THEME_LABELS[theme])}
            selected={themes.includes(theme)}
            onPress={() => setThemes((current) => toggleValue(current, theme))}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.difficulty')}</Text>
      <View style={styles.chips}>
        {DIFFICULTY_TOLERANCES.map((value) => (
          <Chip
            key={value}
            label={t(MEDIA_DIFFICULTY_LABELS[value])}
            selected={difficulty === value}
            onPress={() => setDifficulty(value)}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.subtitles')}</Text>
      <View style={styles.chips}>
        {SUBTITLE_PREFS.map((value) => (
          <Chip
            key={value}
            label={t(MEDIA_SUBTITLE_LABELS[value])}
            selected={subtitles === value}
            onPress={() => setSubtitles(value)}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.weekly')}</Text>
      <View style={styles.chips}>
        {MEDIA_WEEKLY_MINUTES.map((value) => (
          <Chip
            key={value}
            label={t('common.minutes', { count: value })}
            selected={weeklyMinutes === value}
            onPress={() => setWeeklyMinutes(value)}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.region')}</Text>
      <View style={styles.chips}>
        {MEDIA_REGIONS.map((value) => (
          <Chip
            key={value}
            label={t(MEDIA_REGION_LABELS[value])}
            selected={region === value}
            onPress={() => setRegion(value)}
            disabled={busy}
          />
        ))}
      </View>

      <Text style={styles.label}>{t('practice.media.taste.dislikes')}</Text>
      <View style={styles.chips}>
        {MEDIA_DISLIKES.map((value) => (
          <Chip
            key={value}
            label={t(MEDIA_DISLIKE_LABELS[value])}
            selected={disliked.includes(value)}
            onPress={() => setDisliked((current) => toggleValue(current, value))}
            disabled={busy}
          />
        ))}
      </View>

      {status === 'invalid' ? (
        <Text style={styles.error}>{t('practice.media.taste.required')}</Text>
      ) : null}
      {status === 'error' ? (
        <Text style={styles.error}>{t('errors.generic')}</Text>
      ) : null}
      {status === 'saved' ? (
        <Text style={styles.saved}>{t('practice.media.taste.saved')}</Text>
      ) : null}

      <Button
        label={t('practice.media.taste.save')}
        onPress={() => void handleSave()}
        disabled={busy || status === 'saving'}
      />
      {initial ? (
        <Button
          label={t('practice.media.taste.reset')}
          variant="danger"
          onPress={() => void handleReset()}
          disabled={busy}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: typography.subtitle.fontSize,
    lineHeight: typography.subtitle.lineHeight,
    fontWeight: typography.subtitle.fontWeight,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  saved: {
    color: colors.primary,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
