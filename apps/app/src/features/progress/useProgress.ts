import type { ProgressSummary, WeekInsights } from '@loqua/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchInsights, fetchProgress } from '../../lib/api';

export interface ProgressController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly progress: ProgressSummary | null;
  readonly insights: WeekInsights | null;
  reload(): void;
}

export function useProgress(): ProgressController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [insights, setInsights] = useState<WeekInsights | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [nextProgress, nextInsights] = await Promise.all([fetchProgress(), fetchInsights()]);
      setProgress(nextProgress);
      setInsights(nextInsights);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    loading,
    error,
    progress,
    insights,
    reload: () => void load(),
  };
}
