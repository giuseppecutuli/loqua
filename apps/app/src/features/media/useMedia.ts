import type { TasteProfile } from '@loqua/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  deleteMediaTaste,
  fetchMediaPlan,
  fetchMediaProgress,
  fetchMediaRecommendations,
  fetchMediaTaste,
  fetchMediaGuide,
  saveMediaProgress,
  saveMediaTaste,
  sendMediaFeedback,
  submitMediaReflection,
} from './api';
import type {
  MediaGuideView,
  MediaPlanView,
  MediaProgressView,
  MediaRecommendationView,
  MediaReflectionInput,
  MediaReflectionView,
  MediaTaste,
} from './types';

export type { MediaReflectionInput };

export interface MediaController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly taste: MediaTaste | null;
  readonly recommendations: readonly MediaRecommendationView[];
  readonly progress: readonly MediaProgressView[];
  readonly plan: MediaPlanView | null;
  readonly selected: MediaRecommendationView | null;
  readonly selectedProgress: MediaProgressView | null;
  readonly guide: MediaGuideView | null;
  readonly guideLoading: boolean;
  readonly busy: boolean;
  readonly reflection: MediaReflectionView | null;
  reload(): void;
  saveTaste(taste: TasteProfile): Promise<void>;
  resetTaste(): Promise<void>;
  startGuide(mediaId: string): Promise<void>;
  reject(mediaId: string): Promise<void>;
  tooHard(mediaId: string): Promise<void>;
  finish(mediaId: string): Promise<void>;
  abandon(mediaId: string): Promise<void>;
  reflect(mediaId: string, input: MediaReflectionInput): Promise<MediaReflectionView>;
}

function upsertProgress(
  list: readonly MediaProgressView[],
  next: MediaProgressView,
): MediaProgressView[] {
  return [next, ...list.filter((item) => item.mediaId !== next.mediaId)];
}

export function useMedia(): MediaController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [taste, setTaste] = useState<MediaTaste | null>(null);
  const [recommendations, setRecommendations] = useState<readonly MediaRecommendationView[]>([]);
  const [progress, setProgress] = useState<readonly MediaProgressView[]>([]);
  const [plan, setPlan] = useState<MediaPlanView | null>(null);
  const [selected, setSelected] = useState<MediaRecommendationView | null>(null);
  const [guide, setGuide] = useState<MediaGuideView | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reflection, setReflection] = useState<MediaReflectionView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [nextTaste, nextRecommendations, nextProgress, nextPlan] = await Promise.all([
        fetchMediaTaste(),
        fetchMediaRecommendations(5),
        fetchMediaProgress(),
        fetchMediaPlan(),
      ]);
      setTaste(nextTaste);
      setRecommendations(nextRecommendations.recommendations);
      setProgress(nextProgress);
      setPlan(nextPlan);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextTaste, nextRecommendations, nextProgress, nextPlan] = await Promise.all([
        fetchMediaTaste(),
        fetchMediaRecommendations(5),
        fetchMediaProgress(),
        fetchMediaPlan(),
      ]);
      setTaste(nextTaste);
      setRecommendations(nextRecommendations.recommendations);
      setProgress(nextProgress);
      setPlan(nextPlan);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveTaste = useCallback(
    async (nextTaste: TasteProfile) => {
      setBusy(true);
      try {
        const saved = await saveMediaTaste(nextTaste);
        setTaste(saved);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const resetTaste = useCallback(async () => {
    setBusy(true);
    try {
      await deleteMediaTaste();
      setTaste(null);
      setRecommendations([]);
      setSelected(null);
      setGuide(null);
      setReflection(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const startGuide = useCallback(
    async (mediaId: string) => {
      const recommendation = recommendations.find((item) => item.media.id === mediaId) ?? null;
      setSelected(recommendation);
      setGuide(null);
      setReflection(null);
      setGuideLoading(true);
      try {
        const result = await fetchMediaGuide(mediaId);
        setGuide(result.guide);
        const nextProgress = result.progress;
        if (nextProgress) {
          setProgress((current) => upsertProgress(current, nextProgress));
        }
      } catch {
        setGuide(null);
        setError(true);
      } finally {
        setGuideLoading(false);
      }
    },
    [recommendations],
  );

  const sendFeedback = useCallback(
    async (mediaId: string, kind: 'rejected', difficulty?: 'too_hard') => {
      const recommendation = recommendations.find((item) => item.media.id === mediaId);
      setBusy(true);
      try {
        await sendMediaFeedback(mediaId, {
          kind,
          difficulty,
          recommendationId: recommendation?.recommendationId,
        });
        if (selected?.media.id === mediaId) {
          setSelected(null);
          setGuide(null);
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [recommendations, refresh, selected],
  );

  const reject = useCallback(
    async (mediaId: string) => {
      await sendFeedback(mediaId, 'rejected');
    },
    [sendFeedback],
  );

  const tooHard = useCallback(
    async (mediaId: string) => {
      await sendFeedback(mediaId, 'rejected', 'too_hard');
    },
    [sendFeedback],
  );

  const finish = useCallback(
    async (mediaId: string) => {
      setBusy(true);
      try {
        const next = await saveMediaProgress(mediaId, 'finished', 100);
        setProgress((current) => upsertProgress(current, next));
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const abandon = useCallback(
    async (mediaId: string) => {
      setBusy(true);
      try {
        const existing = progress.find((item) => item.mediaId === mediaId);
        const next = await saveMediaProgress(mediaId, 'abandoned', existing?.progressPct ?? 0);
        setProgress((current) => upsertProgress(current, next));
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [progress, refresh],
  );

  const reflect = useCallback(
    async (mediaId: string, input: MediaReflectionInput) => {
      setBusy(true);
      try {
        const result = await submitMediaReflection(mediaId, {
          text: input.text,
          phrases: [...input.phrases],
        });
        setReflection(result);
        await refresh();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const selectedProgress =
    selected === null
      ? null
      : (progress.find((item) => item.mediaId === selected.media.id) ?? null);

  return {
    loading,
    error,
    taste,
    recommendations,
    progress,
    plan,
    selected,
    selectedProgress,
    guide,
    guideLoading,
    busy,
    reflection,
    reload: () => void load(),
    saveTaste,
    resetTaste,
    startGuide,
    reject,
    tooHard,
    finish,
    abandon,
    reflect,
  };
}
