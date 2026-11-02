import type { PlacementFeedback, SessionView } from '@loqua/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { savePhrase, startSession, submitSessionAttempt } from '../../lib/api';

export interface SessionController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly session: SessionView | null;
  readonly feedback: PlacementFeedback | null;
  readonly selected: string | null;
  readonly busy: boolean;
  readonly phraseSaved: boolean;
  choose(answer: { readonly optionId?: string; readonly text?: string }): Promise<void>;
  saveCurrentPhrase(text: string, sourceRef: string): Promise<void>;
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
  const [phraseSaved, setPhraseSaved] = useState(false);
  const itemStartedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setFeedback(null);
    setSelected(null);
    setPendingSession(null);
    setPhraseSaved(false);
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
    async (answer: { readonly optionId?: string; readonly text?: string }) => {
      const current = session?.current;
      if (!current || busy || feedback) return;
      setBusy(true);
      setSelected(answer.optionId ?? answer.text ?? null);
      setError(false);
      try {
        const response = await submitSessionAttempt(
          session.id,
          current.id,
          answer,
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

  const saveCurrentPhrase = useCallback(
    async (text: string, sourceRef: string) => {
      if (phraseSaved || !session?.current) return;
      try {
        await savePhrase(text, sourceRef);
        setPhraseSaved(true);
      } catch {
        setError(true);
      }
    },
    [phraseSaved, session],
  );

  const advance = useCallback(() => {
    if (pendingSession) {
      setSession(pendingSession);
      setPendingSession(null);
    }
    setFeedback(null);
    setSelected(null);
    setPhraseSaved(false);
  }, [pendingSession]);

  return {
    loading,
    error,
    session,
    feedback,
    selected,
    busy,
    phraseSaved,
    choose,
    saveCurrentPhrase,
    advance,
    reload: () => void load(),
  };
}
