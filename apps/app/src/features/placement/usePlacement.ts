import type {
  PlacementAnswer,
  PlacementFeedback,
  PlacementResult,
  PlacementStart,
} from '@loqua/core';
import { useCallback, useEffect, useState } from 'react';

import { answerPlacement, skipWriting, startPlacement, submitWriting } from '../../lib/api';
import { useProfile } from '../../providers/ProfileProvider';

export interface PlacementController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly session: PlacementStart | null;
  readonly feedback: PlacementFeedback | null;
  readonly selected: string | null;
  readonly result: PlacementResult | null;
  readonly busy: boolean;
  choose(optionId: string): Promise<void>;
  advance(): void;
  submitWriting(text: string): Promise<void>;
  skipWriting(): Promise<void>;
  restart(): Promise<void>;
}

export function usePlacement(): PlacementController {
  const { refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [session, setSession] = useState<PlacementStart | null>(null);
  const [pending, setPending] = useState<PlacementAnswer | null>(null);
  const [feedback, setFeedback] = useState<PlacementFeedback | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setSession(null);
    setPending(null);
    setFeedback(null);
    setSelected(null);
    setResult(null);
    try {
      setSession(await startPlacement());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = useCallback(
    async (optionId: string) => {
      if (!session?.item || busy || feedback) return;
      setBusy(true);
      setSelected(optionId);
      setError(false);
      try {
        const answer = await answerPlacement(session.assessmentId, session.item.id, optionId);
        setFeedback(answer.feedback);
        if (answer.completed && answer.result) {
          setResult(answer.result);
          await refreshProfile();
        } else if (answer.completed) {
          setError(true);
        } else if (answer.stage === 'writing') {
          setSession((current) =>
            current
              ? {
                  ...current,
                  stage: 'writing',
                  item: null,
                  writingTask: answer.writingTask,
                }
              : current,
          );
          setFeedback(null);
          setPending(null);
        } else {
          setPending(answer);
        }
      } catch {
        setError(true);
        setSelected(null);
      } finally {
        setBusy(false);
      }
    },
    [busy, feedback, refreshProfile, session],
  );

  const advance = useCallback(() => {
    const nextItem = pending?.item;
    if (!pending || !nextItem) return;
    const nextProgress = pending.progress;
    setSession((current) =>
      current ? { ...current, item: nextItem, progress: nextProgress } : current,
    );
    setPending(null);
    setFeedback(null);
    setSelected(null);
  }, [pending]);

  const submit = useCallback(
    async (text: string) => {
      if (!session || busy) return;
      setBusy(true);
      setError(false);
      try {
        const answer = await submitWriting(session.assessmentId, text);
        if (answer.completed && answer.result) {
          setResult(answer.result);
          await refreshProfile();
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, refreshProfile, session],
  );

  const skip = useCallback(async () => {
    if (!session || busy) return;
    setBusy(true);
    setError(false);
    try {
      const answer = await skipWriting(session.assessmentId);
      if (answer.completed && answer.result) {
        setResult(answer.result);
        await refreshProfile();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [busy, refreshProfile, session]);

  const restart = useCallback(async () => {
    await load();
  }, [load]);

  return {
    loading,
    error,
    session,
    feedback,
    selected,
    result,
    busy,
    choose,
    advance,
    submitWriting: submit,
    skipWriting: skip,
    restart,
  };
}
