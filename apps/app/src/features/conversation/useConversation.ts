import type { ConversationView } from '@loqua/core';
import { useCallback, useEffect, useState } from 'react';

import {
  completeConversation,
  fetchConversation,
  sendConversationTurn,
} from '../../lib/api';

export interface ConversationController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly conversation: ConversationView | null;
  readonly hint: string | null;
  readonly busy: boolean;
  readonly done: boolean;
  send(text: string): Promise<void>;
  end(): Promise<void>;
  reload(): void;
}

export function useConversation(id: string | null): ConversationController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const next = await fetchConversation(id);
      setConversation(next);
      setDone(next.status === 'completed');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (text: string) => {
      if (!conversation || busy || done || text.trim().length === 0) return;
      setBusy(true);
      setError(false);
      try {
        const reply = await sendConversationTurn(conversation.id, text);
        setConversation(reply.session);
        setHint(reply.hint);
        setDone(reply.done);
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, conversation, done],
  );

  const end = useCallback(async () => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const next = await completeConversation(conversation.id);
      setConversation(next);
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [busy, conversation]);

  return {
    loading,
    error,
    conversation,
    hint,
    busy,
    done,
    send,
    end,
    reload: () => void load(),
  };
}
