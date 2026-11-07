import type {
  ConversationReply,
  ConversationReport,
  ConversationView,
} from '@loqua/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiBaseUrl } from '../../lib/http';
import {
  completeConversation,
  fetchConversation,
  fetchConversationReport,
  fetchStreamTicket,
  parseConversationReply,
  sendConversationTurn,
  sendConversationVoice,
  streamingUrl,
} from './api';
import {
  bytesToBase64,
  encodePcm16Wav,
  isStreamingAudioSupported,
  startStreamingCapture,
  STREAMING_SAMPLE_RATE,
  type StreamingCapture,
} from '../../lib/streaming-audio';

export interface ConversationController {
  readonly loading: boolean;
  readonly error: boolean;
  readonly conversation: ConversationView | null;
  readonly hint: string | null;
  readonly report: ConversationReport | null;
  readonly busy: boolean;
  readonly done: boolean;
  readonly partialTranscript: string | null;
  readonly streaming: boolean;
  send(text: string): Promise<void>;
  sendVoice(audioBase64: string, durationSec: number): Promise<void>;
  sendVoiceStreaming(): Promise<boolean>;
  stopVoiceStreaming(): void;
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
  const [partialTranscript, setPartialTranscript] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const captureRef = useRef<StreamingCapture | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

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

  const stopVoiceStreaming = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const sendVoiceStreaming = useCallback(async (): Promise<boolean> => {
    if (!conversation || busy || done) return false;
    const base = apiBaseUrl();
    if (!base || !isStreamingAudioSupported()) return false;

    setBusy(true);
    setError(false);
    setStreaming(true);
    setPartialTranscript(null);

    const chunks: Uint8Array[] = [];
    let sampleCount = 0;
    let capture: StreamingCapture | null = null;
    let socket: WebSocket | null = null;

    try {
      const { ticket } = await fetchStreamTicket(conversation.id);
      const url = streamingUrl(
        `${base}/v1/conversations/${encodeURIComponent(conversation.id)}/stream`,
        ticket,
      );
      const activeSocket = new WebSocket(url);
      socket = activeSocket;
      socketRef.current = activeSocket;
      activeSocket.binaryType = 'arraybuffer';

      const reply = await new Promise<ConversationReply>((resolve, reject) => {
        let settled = false;
        const resolveOnce = (value: ConversationReply): void => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const rejectOnce = (reason: Error): void => {
          if (settled) return;
          settled = true;
          reject(reason);
        };

        const startCapture = (): void => {
          capture = startStreamingCapture({
            onChunk: (chunk) => {
              chunks.push(chunk);
              sampleCount += chunk.byteLength / 2;
              if (activeSocket.readyState === WebSocket.OPEN) {
                activeSocket.send(chunk);
              }
            },
            onSpeechStart: () => setPartialTranscript(''),
            onSilence: () => {
              if (activeSocket.readyState === WebSocket.OPEN) {
                activeSocket.send(JSON.stringify({ type: 'stop' }));
              }
            },
            onError: () => rejectOnce(new Error('microphone_unavailable')),
          });
          captureRef.current = capture;
          if (!capture) rejectOnce(new Error('streaming_unsupported'));
        };

        activeSocket.onmessage = (event) => {
          if (typeof event.data !== 'string') return;
          let message: unknown;
          try {
            message = JSON.parse(event.data);
          } catch {
            return;
          }
          const type =
            typeof message === 'object' && message !== null
              ? Reflect.get(message, 'type')
              : null;
          if (type === 'ready') {
            startCapture();
            return;
          }
          if (type === 'partial') {
            const transcript =
              typeof message === 'object' && message !== null
                ? Reflect.get(message, 'transcript')
                : null;
            if (typeof transcript === 'string') setPartialTranscript(transcript);
            return;
          }
          if (type === 'turn') {
            try {
              resolveOnce(parseConversationReply(message));
            } catch {
              rejectOnce(new Error('invalid_stream_reply'));
            }
            return;
          }
          if (type === 'error') {
            const code =
              typeof message === 'object' && message !== null
                ? Reflect.get(message, 'code')
                : null;
            rejectOnce(new Error(typeof code === 'string' ? code : 'stream_error'));
          }
        };
        activeSocket.onerror = () => rejectOnce(new Error('stream_error'));
        activeSocket.onclose = () => rejectOnce(new Error('stream_closed'));
      });

      setConversation(reply.session);
      setHint(reply.hint);
      setDone(reply.done);
      return true;
    } catch {
      if (sampleCount >= STREAMING_SAMPLE_RATE / 2) {
        try {
          const wav = encodePcm16Wav(chunks, STREAMING_SAMPLE_RATE);
          const fallback = await sendConversationVoice(
            conversation.id,
            bytesToBase64(wav),
            Math.max(1, Math.round(sampleCount / STREAMING_SAMPLE_RATE)),
          );
          setConversation(fallback.session);
          setHint(fallback.hint);
          setDone(fallback.done);
          return true;
        } catch {
          setError(true);
          return false;
        }
      }
      setError(true);
      return false;
    } finally {
      captureRef.current?.stop();
      captureRef.current = null;
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) socket.close();
        socketRef.current = null;
      }
      setStreaming(false);
      setPartialTranscript(null);
      setBusy(false);
    }
  }, [busy, conversation, done]);

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
    partialTranscript,
    streaming,
    loadReport,
    send,
    sendVoice,
    sendVoiceStreaming,
    stopVoiceStreaming,
    end,
    reload: () => void load(),
  };
}
