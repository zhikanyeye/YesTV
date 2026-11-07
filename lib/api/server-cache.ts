/**
 * Server-side TTL cache for upstream API responses.
 * Reduces repeated network round-trips to video sources (aligned with
 * MoonTV/LunaTV's server-side cache_time approach).
 * Uses a plain module-level Map: works on Node (Docker/Vercel) and inside
 * a Cloudflare Workers isolate (cache resets on restart, which is harmless).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency for LRU eviction
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      // Evict least-recently-used (Map preserves insertion order)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    // Drop expired entries so the reported size stays meaningful
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    return this.store.size;
  }
}

export interface CachedSourceSearch {
  videos: Array<Record<string, unknown>>;
  latency: number;
}

// Search results: short TTL keeps new releases fresh while absorbing
// repeated queries (re-sorting, revisiting the page within a session)
export const searchCache = new TTLCache<CachedSourceSearch>(500);
export const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

// Details change rarely; longer TTL removes latency on every play-page open
export const detailCache = new TTLCache<unknown>(1000);
export const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
