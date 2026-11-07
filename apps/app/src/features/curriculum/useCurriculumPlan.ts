import type { CurriculumPlan } from '@loqua/core';
import { useEffect, useState } from 'react';

import { fetchCurriculumPlan } from '../progress/api';

export function useCurriculumPlan(): {
  readonly plan: CurriculumPlan | null;
  readonly loading: boolean;
} {
  const [plan, setPlan] = useState<CurriculumPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchCurriculumPlan()
      .then((next) => {
        if (active) setPlan(next);
      })
      .catch(() => {
        if (active) setPlan(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { plan, loading };
}
