import { createHash } from 'node:crypto';

export interface TtsSynthesizer {
  synthesize(input: {
    readonly text: string;
    readonly targetLang: string;
    readonly voice: string;
  }): Promise<{ readonly audioBase64: string; readonly contentType: string }>;
}

export interface CachedSpeech {
  readonly key: string;
  readonly audioBase64: string;
  readonly contentType: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
}

export class InMemoryTtsCache {
  private readonly entries = new Map<string, CachedSpeech>();

  get(key: string): CachedSpeech | null {
    return this.entries.get(key) ?? null;
  }

  set(entry: CachedSpeech): void {
    this.entries.set(entry.key, entry);
  }

  size(): number {
    return this.entries.size;
  }
}

export function ttsCacheKey(text: string, targetLang: string, voice: string): string {
  return createHash('sha256')
    .update(`${targetLang.trim().toLowerCase()}\u0000${voice.trim().toLowerCase()}\u0000${text.trim()}`)
    .digest('hex');
}

export async function synthesizeWithCache(input: {
  readonly text: string;
  readonly targetLang: string;
  readonly voice: string;
  readonly synthesizer: TtsSynthesizer;
  readonly cache: InMemoryTtsCache;
  readonly now: Date;
}): Promise<{ readonly audioBase64: string; readonly contentType: string; readonly cached: boolean }> {
  const key = ttsCacheKey(input.text, input.targetLang, input.voice);
  const cached = input.cache.get(key);
  if (cached) return { audioBase64: cached.audioBase64, contentType: cached.contentType, cached: true };

  const synthesized = await input.synthesizer.synthesize({
    text: input.text,
    targetLang: input.targetLang,
    voice: input.voice,
  });
  const timestamp = input.now.toISOString();
  input.cache.set({
    key,
    audioBase64: synthesized.audioBase64,
    contentType: synthesized.contentType,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  });
  return { ...synthesized, cached: false };
}
