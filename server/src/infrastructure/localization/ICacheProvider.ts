/**
 * ICacheProvider
 *
 * Pluggable cache abstraction. Implement this interface to swap
 * MemoryCacheProvider for a Redis-backed provider without changing any callers.
 */
export interface ICacheProvider {
  /**
   * Retrieve a cached value.
   * Returns `undefined` on cache miss or expiry.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Store a value in the cache.
   * @param ttlMs  Time-to-live in milliseconds. Provider handles expiry.
   */
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;

  /**
   * Remove a specific key from the cache.
   */
  delete(key: string): Promise<void>;

  /**
   * Remove all keys matching a prefix pattern.
   * Used to invalidate all translations for a given entity.
   */
  deleteByPrefix(prefix: string): Promise<void>;

  /**
   * Clear the entire cache (use with caution).
   */
  clear(): Promise<void>;
}
