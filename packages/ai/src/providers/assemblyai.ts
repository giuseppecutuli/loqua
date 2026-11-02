import { AssemblyAI } from 'assemblyai';

export const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com';

export type AssemblyAiErrorCode =
  | 'transcription_failed'
  | 'timeout'
  | 'empty_transcript';

export class AssemblyAiError extends Error {
  readonly code: AssemblyAiErrorCode;

  constructor(code: AssemblyAiErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AssemblyAiError';
    this.code = code;
  }
}

export interface AssemblyAiTranscribeParams {
  readonly audio: Uint8Array;
  readonly languageCode?: string;
}

export interface AssemblyAiTranscriptResult {
  readonly text?: string | null;
  readonly audio_duration?: number | null;
  readonly language_code?: string | null;
  readonly status: string;
}

export interface AssemblyAiClientLike {
  readonly transcripts: {
    transcribe(
      params: { audio: Uint8Array; language_code?: string },
      options?: { pollingInterval?: number; pollingTimeout?: number },
    ): Promise<AssemblyAiTranscriptResult>;
  };
}

export interface AssemblyAiTranscriberOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly client?: AssemblyAiClientLike;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

export interface TranscribeInput {
  readonly audio: Uint8Array;
  readonly languageCode?: string;
  readonly signal?: AbortSignal;
}

export interface TranscribeResult {
  readonly text: string;
  readonly durationSec: number;
  readonly languageCode: string | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AssemblyAiError('timeout', 'AssemblyAI transcription timed out'));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class AssemblyAiTranscriber {
  readonly name = 'assemblyai';
  private readonly client: AssemblyAiClientLike;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: AssemblyAiTranscriberOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? 3000;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    if (options.client) {
      this.client = options.client;
      return;
    }
    if (!options.apiKey) {
      throw new Error('AssemblyAI apiKey or client is required');
    }
    this.client = new AssemblyAI({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? ASSEMBLYAI_BASE_URL,
    });
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (input.signal?.aborted) {
      throw new AssemblyAiError('transcription_failed', 'Transcription aborted', {
        cause: input.signal.reason,
      });
    }

    try {
      const transcript = await withTimeout(
        this.client.transcripts.transcribe(
          {
            audio: input.audio,
            ...(input.languageCode ? { language_code: input.languageCode } : {}),
          },
          {
            pollingInterval: this.pollIntervalMs,
            pollingTimeout: this.timeoutMs,
          },
        ),
        this.timeoutMs,
      );

      if (transcript.status !== 'completed') {
        throw new AssemblyAiError(
          'transcription_failed',
          `AssemblyAI returned status ${transcript.status}`,
        );
      }
      const text = (transcript.text ?? '').trim();
      if (text.length === 0) {
        throw new AssemblyAiError('empty_transcript', 'AssemblyAI returned an empty transcript');
      }
      return {
        text,
        durationSec: transcript.audio_duration ?? 0,
        languageCode: transcript.language_code ?? null,
      };
    } catch (error) {
      if (error instanceof AssemblyAiError) throw error;
      if (error instanceof Error && /timed? ?out/i.test(error.message)) {
        throw new AssemblyAiError('timeout', 'AssemblyAI transcription timed out', { cause: error });
      }
      throw new AssemblyAiError(
        'transcription_failed',
        error instanceof Error ? error.message : 'AssemblyAI transcription failed',
        { cause: error },
      );
    }
  }
}
