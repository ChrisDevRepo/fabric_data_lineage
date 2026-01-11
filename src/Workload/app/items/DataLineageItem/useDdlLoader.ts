/**
 * useDdlLoader Hook
 *
 * Centralized async loading pattern for DDL with:
 * - 10s timeout to prevent infinite waits
 * - Error handling with user-friendly messages
 * - Retry functionality
 * - Loading state management
 *
 * Used by:
 * - DDLViewerPanel (side panel "View SQL")
 * - DataLineageSearchOverlay (full-text search)
 */

import { useState, useCallback, useRef } from 'react';
import { LineageService } from './LineageService';

const DDL_TIMEOUT_MS = 10000; // 10 seconds

export interface DdlLoaderState {
  ddlText: string | null;
  isLoading: boolean;
  error: string | null;
  objectId: number | null;
}

export interface DdlLoaderActions {
  loadDdl: (objectId: number, sourceId?: number) => Promise<void>;
  retry: () => Promise<void>;
  clear: () => void;
}

export type UseDdlLoaderResult = DdlLoaderState & DdlLoaderActions;

/**
 * Hook for loading DDL on-demand with timeout and retry
 */
export function useDdlLoader(service: LineageService | null): UseDdlLoaderResult {
  const [ddlText, setDdlText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<number | null>(null);

  // Store last request params for retry
  const lastRequestRef = useRef<{ objectId: number; sourceId?: number } | null>(null);

  /**
   * Load DDL for a specific object with timeout
   */
  const loadDdl = useCallback(
    async (objId: number, sourceId?: number) => {
      if (!service) {
        setError('Service not available');
        return;
      }

      // Store for retry
      lastRequestRef.current = { objectId: objId, sourceId };
      setObjectId(objId);
      setIsLoading(true);
      setError(null);
      setDdlText(null);

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), DDL_TIMEOUT_MS);
        });

        // Race between fetch and timeout
        const result = await Promise.race([
          service.getDdlForObject(objId, sourceId),
          timeoutPromise,
        ]);

        setDdlText(result);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message === 'Request timed out'
              ? 'Request timed out. The database may be warming up. Please try again.'
              : err.message
            : 'Failed to load DDL';
        setError(message);
        setDdlText(null);
      } finally {
        setIsLoading(false);
      }
    },
    [service]
  );

  /**
   * Retry the last request
   */
  const retry = useCallback(async () => {
    if (lastRequestRef.current) {
      await loadDdl(lastRequestRef.current.objectId, lastRequestRef.current.sourceId);
    }
  }, [loadDdl]);

  /**
   * Clear state (e.g., when closing panel)
   */
  const clear = useCallback(() => {
    setDdlText(null);
    setIsLoading(false);
    setError(null);
    setObjectId(null);
    lastRequestRef.current = null;
  }, []);

  return {
    ddlText,
    isLoading,
    error,
    objectId,
    loadDdl,
    retry,
    clear,
  };
}

export default useDdlLoader;
