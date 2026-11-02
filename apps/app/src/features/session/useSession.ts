import type { PlacementFeedback, SessionView } from '@loqua/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { startSession, submitSessionAttempt } from '../../lib/api';

export interface SessionController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly session: SessionView | null;
  readonly feedback: PlacementFeedback | null;
  readonly selected: string | null;
  readonly busy: boolean;
  choose(optionId: string): Promise<void>;
  advance(): void;
  reload(): void;
}

export function useSession(): SessionController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [pendingSession, setPendingSession] = useState<SessionView | null>(null);
  const [feedback, setFeedback] = useState<PlacementFeedback | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const itemStartedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setFeedback(null);
    setSelected(null);
    setPendingSession(null);
    try {
      setSession(await startSession());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    itemStartedAt.current = Date.now();
  }, [session?.current?.id]);

  const choose = useCallback(
    async (optionId: string) => {
      const current = session?.current;
      if (!current || busy || feedback) return;
      setBusy(true);
      setSelected(optionId);
      setError(false);
      try {
        const response = await submitSessionAttempt(
          session.id,
          current.id,
          optionId,
          Math.max(0, Date.now() - itemStartedAt.current),
        );
        setPendingSession(response.session);
        setFeedback(response.feedback);
      } catch {
        setError(true);
        setSelected(null);
      } finally {
        setBusy(false);
      }
    },
    [busy, feedback, session],
  );

  const advance = useCallback(() => {
    if (pendingSession) {
      setSession(pendingSession);
      setPendingSession(null);
    }
    setFeedback(null);
    setSelected(null);
  }, [pendingSession]);

  return {
    loading,
    error,
    session,
    feedback,
    selected,
    busy,
    choose,
    advance,
    reload: () => void load(),
  };
}
