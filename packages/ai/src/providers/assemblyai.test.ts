import { describe, expect, it } from 'vitest';

import {
  AssemblyAiError,
  AssemblyAiTranscriber,
  type AssemblyAiClientLike,
} from './assemblyai.js';

function makeTranscriber(
  client: AssemblyAiClientLike,
  options: { timeoutMs?: number } = {},
): AssemblyAiTranscriber {
  return new AssemblyAiTranscriber({
    client,
    pollIntervalMs: 1,
    timeoutMs: options.timeoutMs ?? 1_000,
  });
}

describe('AssemblyAI transcriber', () => {
  it('delegates upload and polling to the official SDK client', async () => {
    const calls: Array<{
      params: { audio: Uint8Array; language_code?: string };
      options?: { pollingInterval?: number; pollingTimeout?: number };
    }> = [];
    const client: AssemblyAiClientLike = {
      transcripts: {
        async transcribe(params, options) {
          calls.push({ params, options });
          return {
            status: 'completed',
            text: ' Hello world ',
            audio_duration: 12.5,
            language_code: 'en',
          };
        },
      },
    };

    const result = await makeTranscriber(client).transcribe({
      audio: new Uint8Array([1, 2, 3]),
      languageCode: 'en',
    });

    expect(result).toEqual({ text: 'Hello world', durationSec: 12.5, languageCode: 'en' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.params.audio).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[0]?.params.language_code).toBe('en');
    expect(calls[0]?.options?.pollingInterval).toBe(1);
  });

  it('maps provider failure status to transcription_failed', async () => {
    const client: AssemblyAiClientLike = {
      transcripts: {
        async transcribe() {
          return { status: 'error', text: null, language_code: null };
        },
      },
    };
    await expect(
      makeTranscriber(client).transcribe({ audio: new Uint8Array([1]) }),
    ).rejects.toMatchObject({ code: 'transcription_failed' });
  });

  it('rejects an empty transcript', async () => {
    const client: AssemblyAiClientLike = {
      transcripts: {
        async transcribe() {
          return { status: 'completed', text: '   ', audio_duration: 3, language_code: 'en' };
        },
      },
    };
    const error = await makeTranscriber(client)
      .transcribe({ audio: new Uint8Array([1]) })
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AssemblyAiError);
    expect(error).toMatchObject({ code: 'empty_transcript' });
  });

  it('times out a stuck transcription', async () => {
    const client: AssemblyAiClientLike = {
      transcripts: {
        transcribe() {
          return new Promise(() => undefined);
        },
      },
    };
    const error = await makeTranscriber(client, { timeoutMs: 5 })
      .transcribe({ audio: new Uint8Array([1]) })
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AssemblyAiError);
    expect(error).toMatchObject({ code: 'timeout' });
  });
});
