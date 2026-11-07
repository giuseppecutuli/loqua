import type { ConversationScenarioView } from '@loqua/core';
import { useCallback, useState } from 'react';

import { startConversation } from './api';
import { useConversationScenarios } from './useConversationScenarios';

export interface TalkController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly scenarios: readonly ConversationScenarioView[];
  readonly starting: string | null;
  readonly startError: boolean;
  reload(): void;
  start(scenarioId: string): Promise<string | null>;
}

export function useTalk(): TalkController {
  const { loading, error, scenarios, reload } = useConversationScenarios();
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState(false);

  const start = useCallback(async (scenarioId: string): Promise<string | null> => {
    setStarting(scenarioId);
    setStartError(false);
    try {
      const conversation = await startConversation(scenarioId);
      return conversation.id;
    } catch {
      setStartError(true);
      return null;
    } finally {
      setStarting(null);
    }
  }, []);

  return { loading, error, scenarios, starting, startError, reload, start };
}
