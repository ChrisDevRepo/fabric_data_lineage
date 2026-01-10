/**
 * FilterCacheService - LocalStorage Cache for Filter Preferences
 *
 * Caches filter selections in localStorage to enable:
 * - Instant filter restoration on page refresh (within same browser)
 * - Personal "working view" that doesn't affect team defaults
 * - 24-hour TTL before falling back to Fabric-saved defaults
 *
 * Storage Scope:
 * - Browser-based (per-user, per-browser, per-device)
 * - Same user, same browser → sees cached filters
 * - Different browser/device → falls back to Fabric defaults
 *
 * This follows the 2-tier persistence model:
 * - Tier 1 (localStorage): Personal session filters (24h TTL)
 * - Tier 2 (Fabric): Team-shared defaults (explicit Save)
 */

import { ObjectType, ExternalRefType } from './types';

const FILTER_CACHE_PREFIX = 'datalineage_filters_';
const DEFAULT_TTL_HOURS = 24; // 1 day

/**
 * Cached filter state structure
 * Includes all filter selections that can be persisted
 */
export interface CachedFilterState {
  selectedSchemas?: string[];
  selectedObjectTypes?: ObjectType[];
  selectedDataModelTypes?: string[];
  selectedExternalTypes?: ExternalRefType[];
  focusSchema?: string | null;
  hideIsolated?: boolean;
  timestamp: string;
}

/**
 * FilterCacheService for localStorage-based filter caching
 */
export class FilterCacheService {
  private itemId: string;
  private sourceId: number | undefined;
  private ttlHours: number;

  constructor(itemId: string, sourceId?: number, ttlHours: number = DEFAULT_TTL_HOURS) {
    this.itemId = itemId;
    this.sourceId = sourceId;
    this.ttlHours = ttlHours;
  }

  /**
   * Update source ID (creates new cache key for different database)
   */
  setSourceId(sourceId: number | undefined): void {
    this.sourceId = sourceId;
  }

  /**
   * Get the cache key for this item (source-aware)
   * Format: datalineage_filters_{itemId}_src{sourceId}
   */
  private getCacheKey(): string {
    if (this.sourceId !== undefined) {
      return `${FILTER_CACHE_PREFIX}${this.itemId}_src${this.sourceId}`;
    }
    return `${FILTER_CACHE_PREFIX}${this.itemId}`;
  }

  /**
   * Get cached filter state (returns null if no cache or expired)
   */
  get(): CachedFilterState | null {
    try {
      const raw = localStorage.getItem(this.getCacheKey());
      if (!raw) return null;

      const cached = JSON.parse(raw) as CachedFilterState;

      // Check TTL (24 hours default)
      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      const ttlMs = this.ttlHours * 60 * 60 * 1000;
      if (ageMs > ttlMs) {
        this.clear(); // Expired, remove it
        return null;
      }

      return cached;
    } catch {
      // Invalid cache entry, remove it
      this.clear();
      return null;
    }
  }

  /**
   * Save filter state to cache
   * Called immediately on every filter change (no debounce needed)
   */
  set(filters: Omit<CachedFilterState, 'timestamp'>): void {
    try {
      const data: CachedFilterState = {
        ...filters,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(this.getCacheKey(), JSON.stringify(data));
    } catch {
      // localStorage might be full or disabled - silently fail
      console.warn('FilterCacheService: Failed to save to localStorage');
    }
  }

  /**
   * Clear cache for this item
   * Called when user explicitly saves to Fabric (cache becomes redundant)
   * or when data source changes
   */
  clear(): void {
    try {
      localStorage.removeItem(this.getCacheKey());
    } catch {
      // Ignore clear failures
    }
  }

  /**
   * Check if cache exists and is valid (not expired)
   */
  hasValidCache(): boolean {
    return this.get() !== null;
  }
}

/**
 * Create a filter cache service for an item
 */
export function createFilterCacheService(itemId: string, ttlHours?: number): FilterCacheService {
  return new FilterCacheService(itemId, ttlHours);
}
