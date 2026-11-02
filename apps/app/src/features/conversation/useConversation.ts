import type { ConversationReport, ConversationView } from '@loqua/core';
import { useCallback, useEffect, useState } from 'react';

import {
  completeConversation,
  fetchConversation,
  fetchConversationReport,
  sendConversationTurn,
  sendConversationVoice,
} from '../../lib/api';

export interface ConversationController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly conversation: ConversationView | null;
  readonly hint: string | null;
  readonly report: ConversationReport | null;
  readonly busy: boolean;
  readonly done: boolean;
  send(text: string): Promise<void>;
  sendVoice(audioBase64: string, durationSec: number): Promise<void>;
  loadReport(): Promise<void>;
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
  const [report, setReport] = useState<ConversationReport | null>(null);

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

  const sendVoice = useCallback(
    async (audioBase64: string, durationSec: number) => {
      if (!conversation || busy || done) return;
      setBusy(true);
      setError(false);
      try {
        const reply = await sendConversationVoice(conversation.id, audioBase64, durationSec);
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

  const loadReport = useCallback(async () => {
    if (!conversation) return;
    try {
      setReport(await fetchConversationReport(conversation.id));
    } catch {
      setError(true);
    }
  }, [conversation]);

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
    report,
    busy,
    done,
    loadReport,
    send,
    sendVoice,
    end,
    reload: () => void load(),
  };
}
