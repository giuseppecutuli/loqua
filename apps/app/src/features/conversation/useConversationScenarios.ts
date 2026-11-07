import type { ConversationScenarioView } from '@loqua/core';
import { useCallback, useEffect, useState } from 'react';

import { fetchConversationScenarios } from './api';

export interface ConversationScenariosController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly scenarios: readonly ConversationScenarioView[];
  reload(): void;
}

export function useConversationScenarios(): ConversationScenariosController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scenarios, setScenarios] = useState<readonly ConversationScenarioView[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setScenarios(await fetchConversationScenarios());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, scenarios, reload: () => void load() };
}
