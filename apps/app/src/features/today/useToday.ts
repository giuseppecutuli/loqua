import type { CurriculumPlan, GamificationSnapshot } from '@loqua/core';
import { useCallback, useEffect, useState } from 'react';

import { useCurriculumPlan } from '../curriculum/useCurriculumPlan';
import { trackEvent } from '../events/api';
import { fetchGamification } from '../progress/api';
import { startSession } from '../session/api';

export interface TodayController {
  readonly gamification: GamificationSnapshot | null;
  readonly planDay: CurriculumPlan['days'][number] | null;
  readonly busy: boolean;
  readonly error: boolean;
  start(dailyMinutes: number | null): Promise<boolean>;
}

export function useToday(): TodayController {
  const { plan } = useCurriculumPlan();
  const [gamification, setGamification] = useState<GamificationSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetchGamification()
      .then(setGamification)
      .catch(() => setGamification(null));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const planDay = plan?.days.find((day) => day.date === today) ?? plan?.days[0] ?? null;

  const start = useCallback(async (dailyMinutes: number | null): Promise<boolean> => {
    setBusy(true);
    setError(false);
    try {
      await startSession();
      void trackEvent('session_started', {
        kind: 'lesson',
        planned_minutes: dailyMinutes ?? 20,
      });
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { gamification, planDay, busy, error, start };
}
