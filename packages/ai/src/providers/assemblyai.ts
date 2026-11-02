import { z } from 'zod';

export type AssemblyAiErrorCode =
  'upload_failed' | 'create_failed' | 'transcription_failed' | 'timeout' | 'empty_transcript';

export class AssemblyAiError extends Error {
  readonly code: AssemblyAiErrorCode;

  constructor(code: AssemblyAiErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AssemblyAiError';
    this.code = code;
  }
}

export interface AssemblyAiTranscriberOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

export interface TranscribeInput {
  readonly audio: Uint8Array;
  readonly contentType?: string;
  readonly languageCode?: string;
  readonly signal?: AbortSignal;
}

export interface TranscribeResult {
  readonly text: string;
  readonly durationSec: number;
  readonly languageCode: string | null;
}

const uploadSchema = z.object({
  upload_url: z.string(),
});

const transcriptCreatedSchema = z.object({
  id: z.string(),
});

const transcriptSchema = z.object({
  status: z.string(),
  text: z.string().nullish(),
  audio_duration: z.number().nullish(),
  language_code: z.string().nullish(),
  error: z.string().nullish(),
});

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
      return;
    }

    const pending: { timer?: ReturnType<typeof setTimeout> } = {};
    const onAbort = (): void => {
      if (pending.timer) clearTimeout(pending.timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
    };

    pending.timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class AssemblyAiTranscriber {
  readonly name = 'assemblyai';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: AssemblyAiTranscriberOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.assemblyai.com/v2').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new AssemblyAiError('timeout', 'AssemblyAI transcription timed out'));
    }, this.timeoutMs);
    const onExternalAbort = (): void => {
      controller.abort(input.signal?.reason);
    };
    if (input.signal) {
      if (input.signal.aborted) {
        controller.abort(input.signal.reason);
      } else {
        input.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const runStage = async <T>(code: AssemblyAiErrorCode, action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (timedOut) {
          throw new AssemblyAiError('timeout', 'AssemblyAI transcription timed out', {
            cause: error,
          });
        }
        if (input.signal?.aborted) throw error;
        if (error instanceof AssemblyAiError) throw error;
        throw new AssemblyAiError(code, `AssemblyAI ${code}`, { cause: error });
      }
    };

    try {
      const uploadUrl = await runStage('upload_failed', () =>
        this.upload(input, controller.signal),
      );
      const transcriptId = await runStage('create_failed', () =>
        this.createTranscript(uploadUrl, input.languageCode, controller.signal),
      );
      return await runStage('transcription_failed', () =>
        this.pollTranscript(transcriptId, controller.signal),
      );
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private async upload(input: TranscribeInput, signal: AbortSignal): Promise<string> {
    const audio = new ArrayBuffer(input.audio.byteLength);
    new Uint8Array(audio).set(input.audio);
    const response = await this.fetchImpl(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        authorization: this.options.apiKey,
        'content-type': input.contentType ?? 'application/octet-stream',
      },
      body: audio,
      signal,
    });
    const payload = await this.readJson(response, 'upload_failed');
    const parsed = uploadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AssemblyAiError('upload_failed', 'AssemblyAI upload response invalid');
    }
    return parsed.data.upload_url;
  }

  private async createTranscript(
    audioUrl: string,
    languageCode: string | undefined,
    signal: AbortSignal,
  ): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/transcript`, {
      method: 'POST',
      headers: {
        authorization: this.options.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        ...(languageCode ? { language_code: languageCode } : {}),
      }),
      signal,
    });
    const payload = await this.readJson(response, 'create_failed');
    const parsed = transcriptCreatedSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AssemblyAiError('create_failed', 'AssemblyAI transcript response invalid');
    }
    return parsed.data.id;
  }

  private async pollTranscript(
    transcriptId: string,
    signal: AbortSignal,
  ): Promise<TranscribeResult> {
    for (;;) {
      await sleep(this.pollIntervalMs, signal);
      const response = await this.fetchImpl(
        `${this.baseUrl}/transcript/${encodeURIComponent(transcriptId)}`,
        {
          method: 'GET',
          headers: { authorization: this.options.apiKey },
          signal,
        },
      );
      const payload = await this.readJson(response, 'transcription_failed');
      const parsed = transcriptSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AssemblyAiError('transcription_failed', 'AssemblyAI transcript response invalid');
      }

      if (parsed.data.status === 'error') {
        throw new AssemblyAiError('transcription_failed', 'AssemblyAI transcription failed');
      }
      if (parsed.data.status !== 'completed') continue;

      const text = parsed.data.text ?? '';
      if (text.trim().length === 0) {
        throw new AssemblyAiError('empty_transcript', 'AssemblyAI returned an empty transcript');
      }

      return {
        text,
        durationSec: parsed.data.audio_duration ?? 0,
        languageCode: parsed.data.language_code ?? null,
      };
    }
  }

  private async readJson(response: Response, code: AssemblyAiErrorCode): Promise<unknown> {
    if (!response.ok) {
      throw new AssemblyAiError(code, `AssemblyAI HTTP ${response.status}`);
    }
    try {
      return JSON.parse(await response.text()) as unknown;
    } catch (error) {
      throw new AssemblyAiError(code, 'AssemblyAI returned invalid JSON', {
        cause: error,
      });
    }
  }
}
