import type { ProgressSummary } from '@loqua/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchProgress } from '../../lib/api';

export interface ProgressController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly progress: ProgressSummary | null;
  reload(): void;
}

export function useProgress(): ProgressController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setProgress(await fetchProgress());
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
    reload: () => void load(),
  };
}
