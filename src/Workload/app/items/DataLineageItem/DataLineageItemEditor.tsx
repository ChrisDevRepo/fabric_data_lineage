/**
 * DataLineageItem Editor
 *
 * Main editor component for the Data Lineage visualization.
 * Uses ItemEditor from the toolkit with view registration.
 *
 * Updated to follow Fabric UX guidelines:
 * - Single ribbon with all controls
 * - Expand button for fullscreen-like experience via page.open()
 * - Refresh button tests GraphQL connectivity
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotificationType } from '@ms-fabric/workload-client';

import { PageProps, ContextProps } from '../../App';
import {
  ItemWithDefinition,
  getWorkloadItem,
  saveWorkloadItem,
} from '../../controller/ItemCRUDController';
import { callNotificationOpen } from '../../controller/NotificationController';
import { callPageOpen } from '../../controller/PageController';
import { callPanelOpen, callSettingsPanelOpen } from '../../controller/PanelController';
import { ItemEditor, RegisteredView } from '../../components/ItemEditor';

import {
  DataLineageItemDefinition,
  DEFAULT_DEFINITION,
  mergeWithDefaults,
  patternToRegex,
} from './DataLineageItemDefinition';
import { DataLineageItemDefaultView, GraphControls } from './DataLineageItemDefaultView';
import { DataLineageItemEmptyViewSimple } from './DataLineageItemEmptyView';
import { DataLineageItemRibbon } from './DataLineageItemRibbon';
import {
  createLineageService,
  DEFAULT_GRAPHQL_ENDPOINT,
  ConnectionPhase,
  DEFAULT_RETRY_CONFIG,
  VwSource,
} from './LineageService';
import { createCacheService, LineageCacheService } from './LineageCacheService';
import { DataNode, ObjectType } from './types';
import { fetchDemoData, DEMO_SOURCE } from './demoDataService';

import './DataLineageItem.scss';

export const EDITOR_VIEW_TYPES = {
  EMPTY: 'empty',
  DEFAULT: 'default',
} as const;

// Use regular enum instead of const enum for better bundler compatibility
enum SaveStatus {
  NotSaved = 'NotSaved',
  Saving = 'Saving',
  Saved = 'Saved',
}

export function DataLineageItemEditor(props: PageProps) {
  const { workloadClient } = props;
  const pageContext = useParams<ContextProps>();
  const { t } = useTranslation();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [item, setItem] = useState<ItemWithDefinition<DataLineageItemDefinition>>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.NotSaved);
  const [currentDefinition, setCurrentDefinition] = useState<DataLineageItemDefinition>(DEFAULT_DEFINITION);
  const [viewSetter, setViewSetter] = useState<((view: string) => void) | null>(null);

  // Graph controls (passed from DefaultView via callback)
  const [graphControls, setGraphControls] = useState<GraphControls | undefined>();

  // Debounce timer for filter persistence (avoid saving on every keystroke)
  const filterSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to track latest values for debounced callbacks (avoid stale closures)
  const itemRef = useRef<ItemWithDefinition<DataLineageItemDefinition>>();
  const definitionRef = useRef<DataLineageItemDefinition>(DEFAULT_DEFINITION);

  // Lineage data from GraphQL
  const [lineageData, setLineageData] = useState<DataNode[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false); // Prevents infinite loop on empty data

  // Connection progress state (for progressive loading UI)
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>(ConnectionPhase.Idle);
  const [connectionMessage, setConnectionMessage] = useState<string>('');
  const [connectionAttempt, setConnectionAttempt] = useState<number>(0);

  // Cache service (created when itemId is available)
  const cacheServiceRef = useRef<LineageCacheService | null>(null);
  const [cacheMetadata, setCacheMetadata] = useState<{ ageMinutes: number; hasCache: boolean } | null>(null);

  // Source databases (for database selector dropdown)
  const [sources, setSources] = useState<VwSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [hasAttemptedLoadSources, setHasAttemptedLoadSources] = useState(false); // Prevents infinite loop on API failure
  const [activeSourceId, setActiveSourceId] = useState<number | undefined>();

  // Memoized LineageService for on-demand DDL loading (passed to DefaultView)
  const graphqlEndpoint = currentDefinition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;
  const lineageServiceRef = useMemo(() => {
    if (!workloadClient || !graphqlEndpoint || currentDefinition.useSampleData) {
      return null;
    }
    return createLineageService(workloadClient, graphqlEndpoint);
  }, [workloadClient, graphqlEndpoint, currentDefinition.useSampleData]);

  const location = useLocation();
  const { pathname, search } = location;

  // Load lineage data from GraphQL with caching and retry
  // If useSampleData is true, loads demo data from static JSON instead
  const loadLineageData = useCallback(async (
    endpoint?: string,
    options?: { skipCache?: boolean; isBackgroundRefresh?: boolean }
  ) => {
    const { skipCache = false, isBackgroundRefresh = false } = options || {};

    // DEMO MODE: If useSampleData is enabled, fetch demo data instead of GraphQL
    if (currentDefinition.useSampleData) {
      if (!isBackgroundRefresh) {
        setIsLoadingData(true);
        setDataLoadError(null);
        setConnectionPhase(ConnectionPhase.LoadingData);
        setConnectionMessage('Loading demo data...');
      }

      try {
        const demoData = await fetchDemoData();
        setLineageData(demoData);
        setConnectionPhase(ConnectionPhase.Completed);
        setConnectionMessage('Demo data loaded');

        // Set demo source as the only available source
        setSources([DEMO_SOURCE]);
        setActiveSourceId(DEMO_SOURCE.source_id);

        return { success: true, count: demoData.length, fromCache: false, isDemo: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!isBackgroundRefresh) {
          setDataLoadError(errorMessage);
          setConnectionPhase(ConnectionPhase.Failed);
          setConnectionMessage(errorMessage);
        }
        return { success: false, error: errorMessage, isDemo: true };
      } finally {
        if (!isBackgroundRefresh) {
          setIsLoadingData(false);
        }
      }
    }

    // NORMAL MODE: Fetch from GraphQL
    const graphqlEndpoint = endpoint || currentDefinition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;

    // Initialize cache service if needed
    const itemId = pageContext.itemObjectId || 'demo';
    if (!cacheServiceRef.current) {
      cacheServiceRef.current = createCacheService(itemId);
    }
    const cache = cacheServiceRef.current;

    // Check cache first (unless skipping or background refresh)
    if (!skipCache && !isBackgroundRefresh) {
      const cachedData = cache.get(graphqlEndpoint);
      if (cachedData && cachedData.length > 0) {
        setLineageData(cachedData);
        setConnectionPhase(ConnectionPhase.Completed);

        // Update cache metadata
        const metadata = cache.getMetadata();
        if (metadata) {
          setCacheMetadata({ ageMinutes: metadata.ageMinutes, hasCache: true });
        }

        // Optionally refresh in background (stale-while-revalidate)
        if (metadata?.isStale) {
          // Fire and forget background refresh
          loadLineageData(endpoint, { isBackgroundRefresh: true });
        }

        return { success: true, count: cachedData.length, fromCache: true };
      }
    }

    // No cache or skip cache - fetch from GraphQL
    if (!isBackgroundRefresh) {
      setIsLoadingData(true);
      setDataLoadError(null);
      setConnectionPhase(ConnectionPhase.Connecting);
      setConnectionAttempt(0);
    }

    try {
      const service = createLineageService(workloadClient, graphqlEndpoint);

      // Set up progress callback (only for foreground requests)
      if (!isBackgroundRefresh) {
        service.setProgressCallback((phase, message, attempt, maxAttempts) => {
          setConnectionPhase(phase);
          setConnectionMessage(message);
          if (attempt !== undefined) {
            setConnectionAttempt(attempt);
          }
        });
      }

      const data = await service.getLineageData();

      // Update state
      setLineageData(data);
      setConnectionPhase(ConnectionPhase.Completed);
      setCurrentDefinition((prev) => ({
        ...prev,
        lastRefreshed: new Date().toISOString(),
      }));

      // Save to cache
      cache.set(data, graphqlEndpoint);
      setCacheMetadata({ ageMinutes: 0, hasCache: true });

      return { success: true, count: data.length, fromCache: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (!isBackgroundRefresh) {
        setDataLoadError(errorMessage);
        setConnectionPhase(ConnectionPhase.Failed);
        setConnectionMessage(errorMessage);

        // If we have stale cache, use it as fallback
        const staleData = cache.getStale();
        if (staleData && staleData.length > 0) {
          setLineageData(staleData);
          const metadata = cache.getMetadata();
          if (metadata) {
            setCacheMetadata({ ageMinutes: metadata.ageMinutes, hasCache: true });
          }
        }
      }

      return { success: false, error: errorMessage };
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoadingData(false);
      }
    }
  }, [workloadClient, currentDefinition.graphqlEndpoint, currentDefinition.useSampleData, pageContext.itemObjectId]);

  // Load available source databases from GraphQL
  // In demo mode, use the demo source instead
  const loadSources = useCallback(async () => {
    // Demo mode: use demo source, don't call GraphQL
    if (currentDefinition.useSampleData) {
      setSources([DEMO_SOURCE]);
      setActiveSourceId(DEMO_SOURCE.source_id);
      return;
    }

    const graphqlEndpoint = currentDefinition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;
    setIsLoadingSources(true);

    try {
      const service = createLineageService(workloadClient, graphqlEndpoint);
      const loadedSources = await service.getSources();

      // Sort alphabetically by database_name
      const sortedSources = [...loadedSources].sort((a, b) =>
        a.database_name.localeCompare(b.database_name)
      );

      setSources(sortedSources);

      // Find the active source (is_active = true)
      const activeSource = sortedSources.find(s => s.is_active);
      if (activeSource) {
        setActiveSourceId(activeSource.source_id);
      } else if (sortedSources.length > 0) {
        // No active source, call SP to set first alphabetical as active
        await service.setActiveSource();
        // Reload to get updated is_active state
        const updatedSources = await service.getSources();
        const newActiveSource = updatedSources.find(s => s.is_active);
        setSources(updatedSources.sort((a, b) => a.database_name.localeCompare(b.database_name)));
        setActiveSourceId(newActiveSource?.source_id);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
      // Don't block the app if sources fail to load - data will still load from active source
    } finally {
      setIsLoadingSources(false);
    }
  }, [workloadClient, currentDefinition.graphqlEndpoint, currentDefinition.useSampleData]);

  // Handle database change from dropdown
  const handleDatabaseChange = useCallback(async (sourceId: number) => {
    if (sourceId === activeSourceId) return; // No change

    const graphqlEndpoint = currentDefinition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;

    try {
      // Call SP to update active source in database
      const service = createLineageService(workloadClient, graphqlEndpoint);
      await service.setActiveSource(sourceId);

      // Update local state
      setActiveSourceId(sourceId);

      // Update sources to reflect new is_active state
      setSources(prev => prev.map(s => ({
        ...s,
        is_active: s.source_id === sourceId,
      })));

      // Clear filters and reload data (views now filter by new active source)
      setCurrentDefinition(prev => ({
        ...prev,
        selectedSchemas: undefined,
        selectedObjectTypes: undefined,
        preferences: {
          ...prev.preferences,
          focusSchema: null,
        },
      }));

      // Clear cache and reload data
      if (cacheServiceRef.current) {
        cacheServiceRef.current.clear();
      }
      setCacheMetadata(null);

      await loadLineageData(undefined, { skipCache: true });

      callNotificationOpen(
        workloadClient,
        t('Database_Changed'),
        t('Database_Changed_Message'),
        undefined,
        undefined
      );
    } catch (error) {
      console.error('Failed to change database:', error);
      callNotificationOpen(
        workloadClient,
        t('Database_Change_Failed'),
        t('Database_Change_Failed_Message'),
        NotificationType.Error,
        undefined
      );
    }
  }, [activeSourceId, workloadClient, currentDefinition.graphqlEndpoint, loadLineageData, t]);

  // Reload definition and data after settings change
  // Detects if data-affecting settings changed (useSampleData, graphqlEndpoint) and reloads data
  const reloadDefinition = useCallback(async () => {
    if (!pageContext.itemObjectId) return;

    // CRITICAL: Cancel any pending filter save to prevent race condition
    // The debounced save would use stale data and overwrite new settings
    if (filterSaveTimerRef.current) {
      clearTimeout(filterSaveTimerRef.current);
      filterSaveTimerRef.current = null;
    }

    try {
      const loadedItem = await getWorkloadItem<DataLineageItemDefinition>(
        workloadClient,
        pageContext.itemObjectId,
        DEFAULT_DEFINITION
      );

      // Use mergeWithDefaults to properly merge nested objects (dataModelConfig, preferences)
      const mergedDefinition = mergeWithDefaults(loadedItem.definition || {});

      // Detect if data source changed (requires data reload)
      const prevDefinition = definitionRef.current;
      const dataSourceChanged =
        prevDefinition.useSampleData !== mergedDefinition.useSampleData ||
        prevDefinition.graphqlEndpoint !== mergedDefinition.graphqlEndpoint;

      setItem((prev) => prev ? { ...prev, definition: mergedDefinition } : prev);
      setCurrentDefinition(mergedDefinition);
      setSaveStatus(SaveStatus.Saved);

      // If data source changed, clear data and trigger reload
      if (dataSourceChanged) {
        setLineageData([]);
        setSources([]);
        setActiveSourceId(undefined);
        setHasAttemptedLoad(false); // Reset to trigger reload
        setHasAttemptedLoadSources(false); // Reset to trigger sources reload
        setDataLoadError(null);
        // Clear cache when switching data sources
        if (cacheServiceRef.current) {
          cacheServiceRef.current.clear();
        }
      }
    } catch (error) {
      console.error('Failed to reload definition:', error);
    }
  }, [workloadClient, pageContext.itemObjectId]);

  // Load item from Fabric
  async function loadDataFromUrl(pageContext: ContextProps, pathname: string): Promise<void> {
    if (pageContext.itemObjectId && item && item.id === pageContext.itemObjectId) {
      return; // Already loaded
    }

    setIsLoading(true);

    if (pageContext.itemObjectId) {
      try {
        const loadedItem = await getWorkloadItem<DataLineageItemDefinition>(
          workloadClient,
          pageContext.itemObjectId,
          DEFAULT_DEFINITION
        );

        // Merge loaded definition with defaults to ensure all fields have values
        // Use mergeWithDefaults to properly merge nested objects (dataModelConfig, preferences)
        const mergedDefinition = mergeWithDefaults(loadedItem.definition || {});
        loadedItem.definition = mergedDefinition;

        setSaveStatus(loadedItem.definition ? SaveStatus.Saved : SaveStatus.NotSaved);
        setItem(loadedItem);
        setCurrentDefinition(mergedDefinition);
      } catch (error) {
        console.error('Failed to load item:', error);
        setItem(undefined);
      }
    } else {
      // Demo mode - no item ID, use sample data
      setCurrentDefinition({ ...DEFAULT_DEFINITION, useSampleData: true });
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadDataFromUrl(pageContext, pathname);
  }, [pageContext, pathname]);

  // Keep refs in sync with state (for debounced callbacks)
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  useEffect(() => {
    definitionRef.current = currentDefinition;
  }, [currentDefinition]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!item) return;

    setSaveStatus(SaveStatus.Saving);

    try {
      await saveWorkloadItem<DataLineageItemDefinition>(workloadClient, {
        ...item,
        definition: currentDefinition,
      });

      setSaveStatus(SaveStatus.Saved);
      callNotificationOpen(
        workloadClient,
        t('Save_Success'),
        t('Save_Success_Message'),
        undefined,
        undefined
      );
    } catch (error) {
      setSaveStatus(SaveStatus.NotSaved);
      callNotificationOpen(
        workloadClient,
        t('Save_Failed'),
        t('Save_Failed_Message'),
        NotificationType.Error,
        undefined
      );
    }
  }, [item, currentDefinition, workloadClient, t]);

  // Filter change handler - persists filter selections with debounce
  const handleFilterChange = useCallback((changes: {
    selectedSchemas?: string[];
    selectedObjectTypes?: ObjectType[];
    focusSchema?: string | null;
    hideIsolated?: boolean;
  }) => {
    // Update current definition with new filter values
    // Note: Use 'key in changes' check instead of ?? for focusSchema because
    // null is a valid value (means "no focus") and ?? treats null as nullish
    setCurrentDefinition(prev => ({
      ...prev,
      selectedSchemas: changes.selectedSchemas ?? prev.selectedSchemas,
      selectedObjectTypes: changes.selectedObjectTypes ?? prev.selectedObjectTypes,
      preferences: {
        ...prev.preferences,
        focusSchema: 'focusSchema' in changes ? changes.focusSchema : prev.preferences?.focusSchema,
        hideIsolated: changes.hideIsolated ?? prev.preferences?.hideIsolated,
      },
    }));

    // Debounced auto-save (1.5s after last change)
    if (filterSaveTimerRef.current) {
      clearTimeout(filterSaveTimerRef.current);
    }

    filterSaveTimerRef.current = setTimeout(async () => {
      // Use refs to get latest values (not stale closure values)
      const latestItem = itemRef.current;
      const latestDef = definitionRef.current;

      if (!latestItem) return;

      try {
        // Build save payload using latest definition from ref
        // Note: Use 'key in changes' check for focusSchema (null is valid value)
        const savePayload = {
          ...latestDef,
          selectedSchemas: changes.selectedSchemas ?? latestDef.selectedSchemas,
          selectedObjectTypes: changes.selectedObjectTypes ?? latestDef.selectedObjectTypes,
          preferences: {
            ...latestDef.preferences,
            focusSchema: 'focusSchema' in changes ? changes.focusSchema : latestDef.preferences?.focusSchema,
            hideIsolated: changes.hideIsolated ?? latestDef.preferences?.hideIsolated,
          },
        };

        await saveWorkloadItem<DataLineageItemDefinition>(workloadClient, {
          ...latestItem,
          definition: savePayload,
        });
        setSaveStatus(SaveStatus.Saved);
      } catch (error) {
        console.error('Failed to auto-save filter preferences:', error);
      }
    }, 1500);
  }, [workloadClient]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (filterSaveTimerRef.current) {
        clearTimeout(filterSaveTimerRef.current);
      }
    };
  }, []);

  // Check for settings saved flag (sessionStorage for cross-iframe communication)
  // Uses visibility change and focus events instead of polling for better performance
  useEffect(() => {
    const itemId = pageContext.itemObjectId || 'demo';

    const checkForSettingsSaved = () => {
      const savedItemId = sessionStorage.getItem('lineage-settings-saved');
      if (savedItemId === itemId) {
        sessionStorage.removeItem('lineage-settings-saved');
        reloadDefinition();
      }
    };

    // Check on visibility change (when panel closes)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForSettingsSaved();
      }
    };

    // Check on window focus (more reliable than visibility for iframe scenarios)
    const handleFocus = () => {
      checkForSettingsSaved();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pageContext.itemObjectId, reloadDefinition]);

  // Settings handler - opens settings panel using Fabric's panel.open API
  // Route includes itemObjectId per MS best practices: /{ItemType}Item-settings/{itemId}
  // Uses callSettingsPanelOpen for proper width (640px) to fit tabs and forms
  // Note: panel.open returns immediately after panel opens, NOT when it closes
  // We use sessionStorage + visibility detection to reload after settings are saved
  const handleOpenSettings = useCallback(async () => {
    const workloadName = process.env.WORKLOAD_NAME || 'Org.DataLineage';
    const itemId = pageContext.itemObjectId || 'demo';
    try {
      await callSettingsPanelOpen(workloadClient, workloadName, `/DataLineageItem-settings/${itemId}`);
      // Don't reload here - panel.open returns immediately, not when panel closes
      // Settings panel sets sessionStorage flag on save, detected by visibility listener
    } catch (error) {
      console.error('Failed to open settings panel:', error);
    }
  }, [workloadClient, pageContext.itemObjectId]);

  // Refresh handler - loads lineage data from GraphQL (always skip cache)
  // Also clears persisted filter selections so user sees all new data
  const handleRefresh = useCallback(async () => {
    // Clear persisted filter selections - user should see all data after refresh
    setCurrentDefinition(prev => ({
      ...prev,
      selectedSchemas: undefined,
      selectedObjectTypes: undefined,
      preferences: {
        ...prev.preferences,
        focusSchema: null,
      },
    }));

    // Skip cache when user explicitly clicks refresh
    const result = await loadLineageData(undefined, { skipCache: true });

    if (result.success) {
      setSaveStatus(SaveStatus.NotSaved);
      const activeSource = sources.find(s => s.source_id === activeSourceId);
      callNotificationOpen(
        workloadClient,
        t('Refresh_Success'),
        t('Refresh_Success_Message', { count: result.count, database: activeSource?.database_name || '' }),
        undefined,
        undefined
      );
    } else {
      callNotificationOpen(
        workloadClient,
        t('Refresh_Failed'),
        result.error || t('Refresh_Failed_Message'),
        NotificationType.Error,
        undefined
      );
    }
  }, [loadLineageData, workloadClient, t, sources, activeSourceId]);

  // Retry handler - for when connection fails (skip cache, retry from scratch)
  const handleRetry = useCallback(async () => {
    setConnectionPhase(ConnectionPhase.Idle);
    setDataLoadError(null);
    await loadLineageData(undefined, { skipCache: true });
  }, [loadLineageData]);


  // Fit view handler (delegates to graph controls)
  const handleFitView = useCallback(() => {
    if (graphControls) {
      graphControls.fitView();
    }
  }, [graphControls]);

  // Export to image handler (delegates to graph controls)
  const handleExportImage = useCallback((mode: 'currentView' | 'fitAll' = 'fitAll') => {
    if (graphControls) {
      graphControls.exportToImage(mode);
    }
  }, [graphControls]);

  // Expand handler - opens full page view using Fabric's page.open API
  // Passes current state via sessionStorage so expanded view shows same data without reload
  const handleExpand = useCallback(async () => {
    const workloadName = process.env.WORKLOAD_NAME || 'Org.DataLineage';
    const itemId = pageContext.itemObjectId || 'demo';
    const expandedPath = `/DataLineageItem-expanded/${itemId}`;

    // Save current state to sessionStorage for expanded view to use
    // This avoids reloading data and preserves filter/trace state
    try {
      const expandState = {
        data: lineageData,
        definition: currentDefinition,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(`lineage-expand-${itemId}`, JSON.stringify(expandState));
    } catch (err) {
      console.warn('Failed to save expand state:', err);
    }

    try {
      await callPageOpen(workloadClient, workloadName, expandedPath);
    } catch (error) {
      console.error('Failed to open expanded view:', error);
      // Fallback: try window.open for cases where page.open doesn't work
      // Requires sandbox relaxation (allow-popups) enabled in manifest
      const expandedUrl = `${window.location.origin}/workloads/${workloadName}${expandedPath}`;
      window.open(expandedUrl, '_blank', 'width=1600,height=900,menubar=no,toolbar=no');
    }
  }, [workloadClient, pageContext.itemObjectId, lineageData, currentDefinition]);

  // Detail Search handler - opens search page using Fabric's page.open API
  const handleDetailSearch = useCallback(async () => {
    const workloadName = process.env.WORKLOAD_NAME || 'Org.DataLineage';
    const itemId = pageContext.itemObjectId || 'demo';
    const searchPath = `/DataLineageItem-search/${itemId}`;

    try {
      await callPageOpen(workloadClient, workloadName, searchPath);
    } catch (error) {
      console.error('Failed to open search page:', error);
      // Fallback: try window.open
      const searchUrl = `${window.location.origin}/workloads/${workloadName}${searchPath}`;
      window.open(searchUrl, '_blank', 'width=1400,height=900,menubar=no,toolbar=no');
    }
  }, [workloadClient, pageContext.itemObjectId]);

  // Help handler - opens help panel using Fabric's panel.open API
  const handleHelp = useCallback(async () => {
    const workloadName = process.env.WORKLOAD_NAME || 'Org.DataLineage';
    try {
      await callPanelOpen(workloadClient, workloadName, '/DataLineageItem-help', true);
    } catch (error) {
      console.error('Failed to open help panel:', error);
    }
  }, [workloadClient]);

  // Controls ready callback
  const handleControlsReady = useCallback((c: GraphControls) => {
    setGraphControls(c);
  }, []);

  // Check if save is enabled
  const isSaveEnabled = saveStatus !== SaveStatus.Saved && saveStatus !== SaveStatus.Saving;

  // Load sources on initial mount (for database dropdown)
  // Uses hasAttemptedLoadSources flag to prevent infinite loop when API fails
  useEffect(() => {
    if (!isLoading && !hasAttemptedLoadSources && !isLoadingSources) {
      setHasAttemptedLoadSources(true);
      loadSources();
    }
  }, [isLoading, hasAttemptedLoadSources, isLoadingSources, loadSources]);

  // Load data on initial mount (after item is loaded)
  // Uses hasAttemptedLoad flag to prevent infinite loop when API returns empty data
  useEffect(() => {
    if (!isLoading && !hasAttemptedLoad && !isLoadingData) {
      // Auto-load data from GraphQL on first render
      setHasAttemptedLoad(true);
      loadLineageData();
    }
  }, [isLoading, hasAttemptedLoad, isLoadingData, loadLineageData]);

  // Filter data using exclude patterns from definition
  // Returns { filtered, excludedCount } to show warning badge in toolbar
  const { filteredData, excludedCount } = useMemo((): { filteredData: DataNode[]; excludedCount: number } => {
    if (lineageData.length === 0) {
      return { filteredData: [], excludedCount: 0 };
    }

    const excludePatterns = currentDefinition.dataModelConfig?.excludePatterns || [];

    if (excludePatterns.length === 0) {
      return { filteredData: lineageData, excludedCount: 0 };
    }

    const regexPatterns = excludePatterns.map(patternToRegex);

    const filtered = lineageData.filter((node) => {
      const fullName = `${node.schema}.${node.name}`;
      // Exclude if any pattern matches
      const shouldExclude = regexPatterns.some((regex) => regex.test(fullName) || regex.test(node.name));
      return !shouldExclude;
    });

    return {
      filteredData: filtered,
      excludedCount: lineageData.length - filtered.length,
    };
  }, [lineageData, currentDefinition.dataModelConfig?.excludePatterns]);

  // Helper to format cache age
  const formatCacheAge = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  // Memoize the view components to prevent unnecessary re-renders
  // Detect "connected but empty" state: load completed, no error, but no data
  const isEmptyData = hasAttemptedLoad && !isLoadingData && lineageData.length === 0 && !dataLoadError;

  const emptyViewComponent = useMemo(() => (
    <DataLineageItemEmptyViewSimple
      onOpenSettings={handleOpenSettings}
      onRetry={handleRetry}
      isLoading={isLoadingData}
      connectionPhase={connectionPhase}
      connectionMessage={connectionMessage}
      connectionAttempt={connectionAttempt}
      maxAttempts={DEFAULT_RETRY_CONFIG.maxAttempts}
      hasCache={cacheMetadata?.hasCache || false}
      cacheAge={cacheMetadata?.ageMinutes !== undefined ? formatCacheAge(cacheMetadata.ageMinutes) : undefined}
      isEmptyData={isEmptyData}
    />
  ), [handleOpenSettings, handleRetry, isLoadingData, connectionPhase, connectionMessage, connectionAttempt, cacheMetadata, isEmptyData]);

  // DefaultView receives lineage data from GraphQL and saved preferences
  const defaultViewComponent = useMemo(() => (
    <DataLineageItemDefaultView
      data={filteredData}
      totalCount={lineageData.length}
      excludedCount={excludedCount}
      isDemo={currentDefinition.useSampleData}
      service={lineageServiceRef}
      sourceId={activeSourceId}
      onControlsReady={handleControlsReady}
      initialPreferences={{
        ...currentDefinition.preferences,
        selectedSchemas: currentDefinition.selectedSchemas,
        selectedObjectTypes: currentDefinition.selectedObjectTypes,
      }}
      dataModelTypes={currentDefinition.dataModelConfig?.types}
      onFilterChange={handleFilterChange}
      isRefreshing={isLoadingData && lineageData.length > 0}
    />
  ), [filteredData, lineageData.length, excludedCount, currentDefinition.useSampleData, lineageServiceRef, activeSourceId, handleControlsReady, currentDefinition.preferences, currentDefinition.selectedSchemas, currentDefinition.selectedObjectTypes, currentDefinition.dataModelConfig?.types, handleFilterChange, isLoadingData]);

  // View registration - memoized to prevent unnecessary re-renders
  const views: RegisteredView[] = useMemo(() => [
    {
      name: EDITOR_VIEW_TYPES.EMPTY,
      component: emptyViewComponent,
    },
    {
      name: EDITOR_VIEW_TYPES.DEFAULT,
      component: defaultViewComponent,
    },
  ], [emptyViewComponent, defaultViewComponent]);

  // Set view based on data availability
  useEffect(() => {
    if (!isLoading && viewSetter) {
      // Show default view if we have data, otherwise show empty view
      const hasData = lineageData.length > 0;
      viewSetter(hasData ? EDITOR_VIEW_TYPES.DEFAULT : EDITOR_VIEW_TYPES.EMPTY);
    }
  }, [isLoading, viewSetter, lineageData.length]);

  // Handle focusNode query parameter (from search page navigation)
  useEffect(() => {
    // Wait for graph controls AND data to be available
    if (!search || !graphControls || lineageData.length === 0) return undefined;

    const params = new URLSearchParams(search);
    const focusNodeId = params.get('focusNode');

    if (!focusNodeId) return undefined;

    // Clear the query param from URL immediately to prevent re-triggering
    window.history.replaceState({}, '', pathname);

    // Delay to ensure ReactFlow has fully rendered the nodes after navigation
    const timeoutId = setTimeout(() => {
      graphControls.focusNode(focusNodeId);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, graphControls, pathname, lineageData.length]);

  return (
    <>
      <ItemEditor
        isLoading={isLoading}
        loadingMessage={t('Loading')}
        ribbon={(context) => (
          <DataLineageItemRibbon
            viewContext={context}
            isSaveEnabled={isSaveEnabled}
            onSave={handleSave}
            onSettings={handleOpenSettings}
            onRefresh={handleRefresh}
            onFitView={handleFitView}
            onExpand={handleExpand}
            onDetailSearch={handleDetailSearch}
            onExportImage={handleExportImage}
            onHelp={handleHelp}
            sources={sources}
            activeSourceId={activeSourceId}
            onDatabaseChange={handleDatabaseChange}
            isLoadingSources={isLoadingSources}
          />
        )}
        views={views}
        viewSetter={(setView) => {
          if (!viewSetter) {
            setViewSetter(() => setView);
          }
        }}
      />
    </>
  );
}
