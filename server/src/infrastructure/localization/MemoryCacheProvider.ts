import { ICacheProvider } from "./ICacheProvider.js";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * MemoryCacheProvider
 *
 * In-process Map-based cache with TTL expiry.
 * Default implementation of ICacheProvider.
 *
 * To migrate to Redis:
 *   1. Create RedisCacheProvider implements ICacheProvider
 *   2. Inject it instead of MemoryCacheProvider in LocalizationService
 *   3. No other code changes needed
 */
export class MemoryCacheProvider implements ICacheProvider {
  private readonly store = new Map<string, Entry<unknown>>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Utility: total number of entries (including expired). Useful for health checks. */
  size(): number {
    return this.store.size;
  }
}
