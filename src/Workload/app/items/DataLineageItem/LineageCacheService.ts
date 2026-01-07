/**
 * LineageCacheService - LocalStorage Cache for Lineage Data
 *
 * Caches GraphQL lineage data in localStorage to enable:
 * - Instant page reload without hitting GraphQL
 * - Offline-first experience when service is warming up
 * - Background refresh with stale-while-revalidate pattern
 *
 * Cache Strategy:
 * 1. On load: Return cached data immediately if valid
 * 2. Fetch fresh data in background
 * 3. Update cache and UI when fresh data arrives
 * 4. If fetch fails but cache exists, continue showing cached data
 */

import { DataNode } from './types';

const CACHE_PREFIX = 'datalineage_cache_';
const DEFAULT_TTL_MINUTES = 60 * 24 * 7; // 7 days

export interface CachedLineageData {
  data: DataNode[];
  timestamp: string;
  endpoint: string;
  version: number; // For cache invalidation on schema changes
}

export interface CacheMetadata {
  timestamp: string;
  nodeCount: number;
  endpoint: string;
  ageMinutes: number;
  isStale: boolean;
}

const CACHE_VERSION = 1; // Increment when DataNode schema changes

/**
 * LineageCacheService for localStorage-based caching
 */
export class LineageCacheService {
  private itemId: string;
  private ttlMinutes: number;

  constructor(itemId: string, ttlMinutes: number = DEFAULT_TTL_MINUTES) {
    this.itemId = itemId;
    this.ttlMinutes = ttlMinutes;
  }

  /**
   * Get the cache key for this item
   */
  private getCacheKey(): string {
    return `${CACHE_PREFIX}${this.itemId}`;
  }

  /**
   * Check if cached data exists and is valid
   */
  hasValidCache(endpoint?: string): boolean {
    try {
      const cached = this.getRawCache();
      if (!cached) return false;

      // Check version compatibility
      if (cached.version !== CACHE_VERSION) return false;

      // Check endpoint match (if provided)
      if (endpoint && cached.endpoint !== endpoint) return false;

      // Check TTL
      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      const ttlMs = this.ttlMinutes * 60 * 1000;
      return ageMs < ttlMs;
    } catch {
      return false;
    }
  }

  /**
   * Get cached data (returns null if no cache or expired)
   */
  get(endpoint?: string): DataNode[] | null {
    try {
      const cached = this.getRawCache();
      if (!cached) return null;

      // Check version compatibility
      if (cached.version !== CACHE_VERSION) {
        this.clear();
        return null;
      }

      // Check endpoint match (if provided)
      if (endpoint && cached.endpoint !== endpoint) return null;

      // Return cached data regardless of age (stale-while-revalidate pattern)
      return cached.data;
    } catch {
      return null;
    }
  }

  /**
   * Get stale data even if expired (for fallback when fetch fails)
   */
  getStale(): DataNode[] | null {
    try {
      const cached = this.getRawCache();
      if (!cached || cached.version !== CACHE_VERSION) return null;
      return cached.data;
    } catch {
      return null;
    }
  }

  /**
   * Get cache metadata (for display in UI)
   */
  getMetadata(): CacheMetadata | null {
    try {
      const cached = this.getRawCache();
      if (!cached) return null;

      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      const ageMinutes = Math.round(ageMs / 60000);
      const ttlMs = this.ttlMinutes * 60 * 1000;

      return {
        timestamp: cached.timestamp,
        nodeCount: cached.data.length,
        endpoint: cached.endpoint,
        ageMinutes,
        isStale: ageMs >= ttlMs,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save data to cache
   */
  set(data: DataNode[], endpoint: string): void {
    try {
      const cacheData: CachedLineageData = {
        data,
        timestamp: new Date().toISOString(),
        endpoint,
        version: CACHE_VERSION,
      };

      localStorage.setItem(this.getCacheKey(), JSON.stringify(cacheData));
    } catch {
      // localStorage might be full or disabled - try to clear old caches
      this.clearOldCaches();
    }
  }

  /**
   * Clear cache for this item
   */
  clear(): void {
    try {
      localStorage.removeItem(this.getCacheKey());
    } catch {
      // Ignore clear failures
    }
  }

  /**
   * Clear all lineage caches (for troubleshooting)
   */
  static clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore clear failures
    }
  }

  /**
   * Get raw cached data structure
   */
  private getRawCache(): CachedLineageData | null {
    try {
      const raw = localStorage.getItem(this.getCacheKey());
      if (!raw) return null;
      return JSON.parse(raw) as CachedLineageData;
    } catch {
      return null;
    }
  }

  /**
   * Clear old/stale caches to free up localStorage space
   */
  private clearOldCaches(): void {
    try {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const cached = JSON.parse(raw) as CachedLineageData;
              const age = now - new Date(cached.timestamp).getTime();
              if (age > maxAge) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Invalid cache entry, remove it
            localStorage.removeItem(key);
          }
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Create a cache service for an item
 */
export function createCacheService(itemId: string, ttlMinutes?: number): LineageCacheService {
  return new LineageCacheService(itemId, ttlMinutes);
}
