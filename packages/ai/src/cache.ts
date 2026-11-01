import type { AiCache, CacheEntry } from './types.js';

export class InMemoryCache implements AiCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, entry: CacheEntry): void {
    this.entries.set(key, entry);
  }

  get size(): number {
    return this.entries.size;
  }
}
