import { describe, expect, it } from 'vitest';

import { AssemblyAiError, AssemblyAiTranscriber } from './assemblyai.js';

interface CapturedRequest {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly body: unknown;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function capturedRequest(input: RequestInfo | URL, init?: RequestInit): CapturedRequest {
  const headers = new Headers(init?.headers);
  return {
    url: String(input),
    method: init?.method ?? 'GET',
    authorization: headers.get('authorization'),
    contentType: headers.get('content-type'),
    body: init?.body,
  };
}

function makeTranscriber(
  fetchImpl: typeof fetch,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
): AssemblyAiTranscriber {
  return new AssemblyAiTranscriber({
    apiKey: 'test-key',
    fetchImpl,
    pollIntervalMs: options.pollIntervalMs ?? 1,
    timeoutMs: options.timeoutMs ?? 1_000,
  });
}

describe('AssemblyAI transcriber', () => {
  it('uploads, creates a transcript, and polls until completion', async () => {
    const captured: CapturedRequest[] = [];
    let polls = 0;

    const fetchImpl: typeof fetch = async (input, init) => {
      captured.push(capturedRequest(input, init));
      const url = String(input);
      if (url.endsWith('/upload')) {
        return jsonResponse({ upload_url: 'https://cdn.assemblyai.com/v2/upload/abc' });
      }
      if (url.endsWith('/transcript')) {
        return jsonResponse({ id: 'tr_123' });
      }
      if (url.endsWith('/transcript/tr_123')) {
        polls += 1;
        return jsonResponse(
          polls === 1
            ? { status: 'queued' }
            : {
                status: 'completed',
                text: 'Hello world',
                audio_duration: 12.5,
                language_code: 'en',
              },
        );
      }
      throw new Error(`unexpected url ${url}`);
    };

    const transcriber = makeTranscriber(fetchImpl);
    const result = await transcriber.transcribe({
      audio: new Uint8Array([1, 2, 3]),
      languageCode: 'en',
    });

    expect(result).toEqual({ text: 'Hello world', durationSec: 12.5, languageCode: 'en' });
    expect(captured.map((request) => request.method)).toEqual(['POST', 'POST', 'GET', 'GET']);
    expect(captured[0]?.url).toBe('https://api.assemblyai.com/v2/upload');
    expect(captured[0]?.authorization).toBe('test-key');
    expect(captured[0]?.contentType).toBe('application/octet-stream');
    expect(captured[1]?.url).toBe('https://api.assemblyai.com/v2/transcript');
    expect(JSON.parse(String(captured[1]?.body))).toEqual({
      audio_url: 'https://cdn.assemblyai.com/v2/upload/abc',
      language_code: 'en',
    });
    expect(captured[2]?.authorization).toBe('test-key');
    expect(polls).toBe(2);
  });

  it('surfaces HTTP failures with a typed upload error', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ error: 'invalid api key' }, 401);

    const transcriber = makeTranscriber(fetchImpl);

    await expect(transcriber.transcribe({ audio: new Uint8Array([1]) })).rejects.toMatchObject({
      name: 'AssemblyAiError',
      code: 'upload_failed',
    });
  });

  it('surfaces a provider transcription error', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/upload')) {
        return jsonResponse({ upload_url: 'https://cdn.assemblyai.com/upload/abc' });
      }
      if (url.endsWith('/transcript')) return jsonResponse({ id: 'tr_err' });
      if (url.endsWith('/transcript/tr_err')) {
        return jsonResponse({ status: 'error', error: 'unsupported audio' });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const transcriber = makeTranscriber(fetchImpl);

    await expect(transcriber.transcribe({ audio: new Uint8Array([1]) })).rejects.toMatchObject({
      code: 'transcription_failed',
    });
  });

  it('times out a stuck poll loop', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/upload')) {
        return jsonResponse({ upload_url: 'https://cdn.assemblyai.com/upload/abc' });
      }
      if (url.endsWith('/transcript')) return jsonResponse({ id: 'tr_slow' });
      if (url.endsWith('/transcript/tr_slow')) return jsonResponse({ status: 'processing' });
      throw new Error(`unexpected url ${url}`);
    };

    const transcriber = makeTranscriber(fetchImpl, { pollIntervalMs: 1, timeoutMs: 20 });

    await expect(transcriber.transcribe({ audio: new Uint8Array([1]) })).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('rejects completed transcripts with empty text', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/upload')) {
        return jsonResponse({ upload_url: 'https://cdn.assemblyai.com/upload/abc' });
      }
      if (url.endsWith('/transcript')) return jsonResponse({ id: 'tr_empty' });
      if (url.endsWith('/transcript/tr_empty')) {
        return jsonResponse({ status: 'completed', text: '   ', audio_duration: 3 });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const transcriber = makeTranscriber(fetchImpl);

    await expect(transcriber.transcribe({ audio: new Uint8Array([1]) })).rejects.toBeInstanceOf(
      AssemblyAiError,
    );
    await expect(transcriber.transcribe({ audio: new Uint8Array([1]) })).rejects.toMatchObject({
      code: 'empty_transcript',
    });
  });
});
