/**
 * useLineageFilters Hook
 * Manages filtering state and logic for the lineage graph
 *
 * Features:
 * - Schema and object type filtering
 * - Search with 150ms debouncing
 * - Focus schema with 1-hop neighbor filtering
 * - Hide isolated nodes toggle
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Graph from 'graphology';
import { DataNode, ObjectType, FilterConfig, ExternalRefType, ALL_EXTERNAL_TYPES } from './types';
import { DataModelTypeRule, EdgeType, classifyObject } from './DataLineageItemDefinition';

// Debounce delay for search
const SEARCH_DEBOUNCE_MS = 150;

export interface UseLineageFiltersResult {
  // Filter state
  filterConfig: FilterConfig;

  // Available options (derived from data)
  availableSchemas: string[];
  availableObjectTypes: ObjectType[];
  availableDataModelTypes: string[];  // Data model type names (Dimension, Fact, Other, etc.)
  availableExternalTypes: ExternalRefType[];  // External types present in data

  // Filtered data
  filteredNodes: DataNode[];

  // Filter actions
  setSelectedSchemas: (schemas: string[]) => void;
  setSelectedObjectTypes: (types: ObjectType[]) => void;
  setSelectedDataModelTypes: (types: string[]) => void;
  setSelectedExternalTypes: (types: ExternalRefType[]) => void;
  setExcludePatterns: (patterns: string[]) => void;
  setHideIsolated: (hide: boolean) => void;
  selectAllSchemas: () => void;
  selectNoSchemas: () => void;
  selectAllTypes: () => void;
  selectNoTypes: () => void;
  selectAllDataModelTypes: () => void;
  selectNoDataModelTypes: () => void;
  selectAllExternalTypes: () => void;
  selectNoExternalTypes: () => void;
  resetFilters: () => void;

  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: DataNode[];

  // View options (configured in Settings Panel, read-only)
  layoutDirection: 'LR' | 'TB';
  showMinimap: boolean;
  showControls: boolean;
  edgeType: EdgeType;

  // Focus Schema (shows focus schema + direct neighbors only)
  focusSchema: string | null;
  setFocusSchema: (schema: string | null) => void;

  // Data model type filter state
  selectedDataModelTypes: string[];

  // External type filter state
  selectedExternalTypes: ExternalRefType[];
}

const ALL_OBJECT_TYPES: ObjectType[] = ['Table', 'View', 'Stored Procedure', 'Function'];

/**
 * Initial filter options - can be provided to initialize state from saved preferences
 */
export interface InitialFilterOptions {
  layoutDirection?: 'LR' | 'TB';
  showMinimap?: boolean;
  showControls?: boolean;
  edgeType?: EdgeType;
  hideIsolated?: boolean;
  focusSchema?: string | null;
  selectedSchemas?: string[];
  selectedObjectTypes?: ObjectType[];
  selectedDataModelTypes?: string[];
  selectedExternalTypes?: ExternalRefType[];  // External types filter
  dataModelTypes?: DataModelTypeRule[];  // Data model type rules for classification
}

/**
 * Callback for when filter state changes (for persistence)
 */
export interface FilterChangeCallback {
  (changes: {
    selectedSchemas?: string[];
    selectedObjectTypes?: ObjectType[];
    selectedDataModelTypes?: string[];
    selectedExternalTypes?: ExternalRefType[];
    focusSchema?: string | null;
    hideIsolated?: boolean;
  }): void;
}

export function useLineageFilters(
  allNodes: DataNode[],
  lineageGraph: Graph,
  initialOptions?: InitialFilterOptions,
  onFilterChange?: FilterChangeCallback
): UseLineageFiltersResult {
  // Derive available options from data
  // External objects have no real schema (schema='') - exclude them from schema filter
  // External objects have their own filter (EXTERNAL TYPES in Types dropdown)
  const availableSchemas = useMemo(() => {
    const schemas = new Set(
      allNodes
        .filter(n => !n.is_external && n.schema && n.schema.trim().length > 0)
        .map(n => n.schema)
    );
    return Array.from(schemas).sort();
  }, [allNodes]);

  const availableObjectTypes = useMemo(() => {
    const types = new Set(allNodes.map(n => n.object_type));
    return ALL_OBJECT_TYPES.filter(t => types.has(t));
  }, [allNodes]);

  // Data model types from settings (for classification)
  const dataModelTypeRules = initialOptions?.dataModelTypes || [];

  // Available data model type names (from settings)
  const availableDataModelTypes = useMemo(() => {
    return dataModelTypeRules.map(t => t.name);
  }, [dataModelTypeRules]);

  // Available external types (derived from data - only types that exist in allNodes)
  const availableExternalTypes = useMemo(() => {
    const types = new Set<ExternalRefType>();
    for (const node of allNodes) {
      if (node.is_external && node.external_ref_type) {
        types.add(node.external_ref_type);
      }
    }
    // Return in consistent order: FILE, OTHER_DB, LINK
    return ALL_EXTERNAL_TYPES.filter(t => types.has(t));
  }, [allNodes]);

  // Pre-classify all nodes by data model type
  const nodeClassifications = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of allNodes) {
      const classified = classifyObject(node.name, dataModelTypeRules);
      map.set(node.id, classified.name);
    }
    return map;
  }, [allNodes, dataModelTypeRules]);

  // Filter state - initialize hideIsolated from saved preferences if provided
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(() => ({
    selectedSchemas: availableSchemas,
    selectedObjectTypes: availableObjectTypes,
    excludePatterns: [],
    hideIsolated: initialOptions?.hideIsolated ?? false,
  }));

  // Data model type filter state (separate from filterConfig for clarity)
  // Initialize with saved preferences or all available types
  const [selectedDataModelTypes, setSelectedDataModelTypesState] = useState<string[]>(
    () => initialOptions?.selectedDataModelTypes || []
  );

  // External type filter state (FILE, OTHER_DB, LINK)
  // Initialize with saved preferences or all available types
  const [selectedExternalTypes, setSelectedExternalTypesState] = useState<ExternalRefType[]>(
    () => initialOptions?.selectedExternalTypes || ALL_EXTERNAL_TYPES
  );

  // Search state with debouncing
  const [searchTerm, setSearchTermImmediate] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Expose setSearchTerm that updates the immediate value
  const setSearchTerm = useCallback((term: string) => {
    setSearchTermImmediate(term);
  }, []);

  // View options - initialize from saved preferences if provided
  // These are read-only from initial options (changed only via Settings Panel)
  const layoutDirection: 'LR' | 'TB' = initialOptions?.layoutDirection ?? 'LR';
  const showMinimap = initialOptions?.showMinimap ?? true;
  const showControls = initialOptions?.showControls ?? true;
  const edgeType: EdgeType = initialOptions?.edgeType ?? 'bezier';

  // Focus Schema state - when set, auto-selects neighbor schemas and filters to direct connections
  const [focusSchema, setFocusSchemaState] = useState<string | null>(
    initialOptions?.focusSchema ?? null
  );

  // Track whether we've applied saved preferences
  // This ensures saved preferences are applied when data first loads
  const hasAppliedSavedPrefs = useRef(false);
  const prevInitialOptionsRef = useRef(initialOptions);
  // Track user changes vs. initial preferences (used by filter actions and sync effects)
  const isUserChange = useRef(false);

  // Detect when initialOptions changes (e.g., item loaded from Fabric or refresh)
  // Don't reset during user-initiated changes (they trigger onFilterChange which updates parent)
  const initialOptionsChanged = prevInitialOptionsRef.current !== initialOptions;
  if (initialOptionsChanged) {
    prevInitialOptionsRef.current = initialOptions;

    if (isUserChange.current) {
      // This change is an echo from our own onFilterChange callback - ignore it
      // Reset the flag now that we've seen the parent's response
      isUserChange.current = false;
    } else {
      // This is a real external change (item loaded, refresh, etc.) - re-apply saved prefs
      hasAppliedSavedPrefs.current = false;
    }
  }

  // Reset focus schema when initialOptions object changes (e.g., after refresh)
  useEffect(() => {
    setFocusSchemaState(initialOptions?.focusSchema ?? null);
  }, [initialOptions]);

  // Sync schema selections when available options change or saved preferences arrive
  useEffect(() => {
    if (availableSchemas.length === 0) return;

    const hasSavedSchemas = initialOptions?.selectedSchemas && initialOptions.selectedSchemas.length > 0;

    if (!hasAppliedSavedPrefs.current && hasSavedSchemas) {
      // Apply saved schema selections (filter to only valid ones)
      const validSaved = initialOptions.selectedSchemas!.filter(s => availableSchemas.includes(s));
      if (validSaved.length > 0) {
        setFilterConfig(prev => ({ ...prev, selectedSchemas: validSaved }));
      } else {
        // Saved schemas don't exist in data, fall back to all
        setFilterConfig(prev => ({ ...prev, selectedSchemas: availableSchemas }));
      }
    } else if (!hasAppliedSavedPrefs.current) {
      // No saved preferences - select all schemas
      setFilterConfig(prev => ({ ...prev, selectedSchemas: availableSchemas }));
    } else {
      // Already applied preferences - just filter out invalid selections
      // Don't reset to all when empty - user may want to show only externals
      setFilterConfig(prev => ({
        ...prev,
        selectedSchemas: prev.selectedSchemas.filter(s => availableSchemas.includes(s)),
      }));
    }
  }, [availableSchemas, initialOptions?.selectedSchemas]);

  // Sync object type selections when available options change or saved preferences arrive
  useEffect(() => {
    if (availableObjectTypes.length === 0) return;

    const hasSavedTypes = initialOptions?.selectedObjectTypes && initialOptions.selectedObjectTypes.length > 0;

    if (!hasAppliedSavedPrefs.current && hasSavedTypes) {
      // Apply saved type selections (filter to only valid ones)
      const validSaved = initialOptions.selectedObjectTypes!.filter(t => availableObjectTypes.includes(t));
      if (validSaved.length > 0) {
        setFilterConfig(prev => ({ ...prev, selectedObjectTypes: validSaved }));
      } else {
        // Saved types don't exist in data, fall back to all
        setFilterConfig(prev => ({ ...prev, selectedObjectTypes: availableObjectTypes }));
      }
      // Mark as applied after both schemas and types are processed
      hasAppliedSavedPrefs.current = true;
    } else if (!hasAppliedSavedPrefs.current) {
      // No saved preferences - select all types
      setFilterConfig(prev => ({ ...prev, selectedObjectTypes: availableObjectTypes }));
      hasAppliedSavedPrefs.current = true;
    } else {
      // Already applied preferences - just filter out invalid selections
      // Don't reset to all when empty - user may want to show only externals
      setFilterConfig(prev => ({
        ...prev,
        selectedObjectTypes: prev.selectedObjectTypes.filter(t => availableObjectTypes.includes(t)),
      }));
    }
  }, [availableObjectTypes, initialOptions?.selectedObjectTypes]);

  // Sync data model type selections when available options change or saved preferences arrive
  useEffect(() => {
    if (availableDataModelTypes.length === 0) return;

    const hasSavedTypes = initialOptions?.selectedDataModelTypes && initialOptions.selectedDataModelTypes.length > 0;

    if (!hasAppliedSavedPrefs.current && hasSavedTypes) {
      // Apply saved data model type selections (filter to only valid ones)
      const validSaved = initialOptions.selectedDataModelTypes!.filter(t => availableDataModelTypes.includes(t));
      if (validSaved.length > 0) {
        setSelectedDataModelTypesState(validSaved);
      } else {
        // Saved types don't exist in data, fall back to all
        setSelectedDataModelTypesState(availableDataModelTypes);
      }
    } else if (selectedDataModelTypes.length === 0) {
      // No saved preferences and no selection yet - select all types
      setSelectedDataModelTypesState(availableDataModelTypes);
    } else {
      // Already have selections - just filter out invalid ones
      const validSelections = selectedDataModelTypes.filter(t => availableDataModelTypes.includes(t));
      if (validSelections.length !== selectedDataModelTypes.length) {
        setSelectedDataModelTypesState(validSelections.length > 0 ? validSelections : availableDataModelTypes);
      }
    }
  }, [availableDataModelTypes, initialOptions?.selectedDataModelTypes]);

  // Track if external types have been initialized (to avoid resetting after user changes)
  const externalTypesInitialized = useRef(false);

  // Sync external type selections when available options change or saved preferences arrive
  // Only runs once when availableExternalTypes first becomes non-empty
  useEffect(() => {
    if (availableExternalTypes.length === 0) return;

    // Only initialize once - don't override user changes
    if (externalTypesInitialized.current) return;

    const hasSavedTypes = initialOptions?.selectedExternalTypes && initialOptions.selectedExternalTypes.length > 0;

    if (hasSavedTypes) {
      // Apply saved external type selections (filter to only valid ones)
      const validSaved = initialOptions.selectedExternalTypes!.filter(t => availableExternalTypes.includes(t));
      if (validSaved.length > 0) {
        setSelectedExternalTypesState(validSaved);
      } else {
        // Saved types don't exist in data, fall back to all
        setSelectedExternalTypesState(availableExternalTypes);
      }
    } else {
      // No saved preferences - select all available types
      setSelectedExternalTypesState(availableExternalTypes);
    }

    externalTypesInitialized.current = true;
  }, [availableExternalTypes, initialOptions?.selectedExternalTypes]);

  // Filter actions - mark as user change to trigger persistence
  // Clicking checkboxes clears focus mode (user is taking manual control)
  const setSelectedSchemas = useCallback((schemas: string[]) => {
    isUserChange.current = true;
    setFocusSchemaState(null);  // Exit focus mode on manual change
    setFilterConfig(prev => ({ ...prev, selectedSchemas: schemas }));
  }, []);

  const setSelectedObjectTypes = useCallback((types: ObjectType[]) => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, selectedObjectTypes: types }));
  }, []);

  const setExcludePatterns = useCallback((patterns: string[]) => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, excludePatterns: patterns }));
  }, []);

  const setHideIsolated = useCallback((hide: boolean) => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, hideIsolated: hide }));
  }, []);

  const selectAllSchemas = useCallback(() => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, selectedSchemas: availableSchemas }));
  }, [availableSchemas]);

  const selectNoSchemas = useCallback(() => {
    isUserChange.current = true;
    setFocusSchemaState(null);  // Clear focus when deselecting all schemas
    setFilterConfig(prev => ({ ...prev, selectedSchemas: [] }));
  }, []);

  const selectAllTypes = useCallback(() => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, selectedObjectTypes: availableObjectTypes }));
  }, [availableObjectTypes]);

  const selectNoTypes = useCallback(() => {
    isUserChange.current = true;
    setFilterConfig(prev => ({ ...prev, selectedObjectTypes: [] }));
  }, []);

  // Data model type filter actions
  const setSelectedDataModelTypes = useCallback((types: string[]) => {
    isUserChange.current = true;
    setSelectedDataModelTypesState(types);
  }, []);

  const selectAllDataModelTypes = useCallback(() => {
    isUserChange.current = true;
    setSelectedDataModelTypesState(availableDataModelTypes);
  }, [availableDataModelTypes]);

  const selectNoDataModelTypes = useCallback(() => {
    isUserChange.current = true;
    setSelectedDataModelTypesState([]);
  }, []);

  // External type filter actions
  const setSelectedExternalTypes = useCallback((types: ExternalRefType[]) => {
    isUserChange.current = true;
    setSelectedExternalTypesState(types);
  }, []);

  const selectAllExternalTypes = useCallback(() => {
    isUserChange.current = true;
    setSelectedExternalTypesState(availableExternalTypes);
  }, [availableExternalTypes]);

  const selectNoExternalTypes = useCallback(() => {
    isUserChange.current = true;
    setSelectedExternalTypesState([]);
  }, []);

  const resetFilters = useCallback(() => {
    isUserChange.current = true;
    setFilterConfig({
      selectedSchemas: availableSchemas,
      selectedObjectTypes: availableObjectTypes,
      excludePatterns: [],
      hideIsolated: false,
    });
    setSelectedDataModelTypesState(availableDataModelTypes);
    setSelectedExternalTypesState(availableExternalTypes);
    setSearchTermImmediate('');
    setDebouncedSearchTerm('');
    setFocusSchemaState(null);
  }, [availableSchemas, availableObjectTypes, availableDataModelTypes, availableExternalTypes]);

  // Notify parent of filter changes for persistence (only on user changes)
  // NOTE: Do NOT reset isUserChange.current here - it must stay true until
  // we've processed the parent's re-render with new initialOptions (see line 226)
  useEffect(() => {
    // Only notify on user-initiated changes, not initial load or data updates
    if (!isUserChange.current) return;

    onFilterChange?.({
      selectedSchemas: filterConfig.selectedSchemas,
      selectedObjectTypes: filterConfig.selectedObjectTypes,
      selectedDataModelTypes,
      selectedExternalTypes,
      focusSchema,
      hideIsolated: filterConfig.hideIsolated,
    });
  }, [
    filterConfig.selectedSchemas,
    filterConfig.selectedObjectTypes,
    filterConfig.hideIsolated,
    selectedDataModelTypes,
    selectedExternalTypes,
    focusSchema,
    onFilterChange,
  ]);

  // Apply filters to nodes
  const filteredNodes = useMemo(() => {
    let result = allNodes;

    // Filter by schema
    // Note: External objects are NOT filtered by schema - they have their own filter (EXTERNAL TYPES)
    if (filterConfig.selectedSchemas.length < availableSchemas.length) {
      result = result.filter(n => n.is_external || filterConfig.selectedSchemas.includes(n.schema));
    }

    // Filter by object type
    // Note: External objects are NOT filtered by object type - they have their own filter (EXTERNAL TYPES)
    if (filterConfig.selectedObjectTypes.length < availableObjectTypes.length) {
      result = result.filter(n => n.is_external || filterConfig.selectedObjectTypes.includes(n.object_type));
    }

    // Filter by data model type (using pre-computed classifications)
    // Only apply filter if:
    // 1. User has explicitly selected some types (length > 0)
    // 2. Not all types are selected (length < available)
    // 3. Available types exist
    // Note: When selectedDataModelTypes is empty (uninitialized), we show all nodes
    // Note: Data model type filter only applies to LOCAL objects (non-external)
    if (selectedDataModelTypes.length > 0 && selectedDataModelTypes.length < availableDataModelTypes.length && availableDataModelTypes.length > 0) {
      result = result.filter(n => {
        // External objects are not classified by data model type
        if (n.is_external) return true;
        const classification = nodeClassifications.get(n.id);
        return classification && selectedDataModelTypes.includes(classification);
      });
    }

    // Filter by external type (FILE, OTHER_DB, LINK)
    // Only filter external objects - local objects are always included
    // When no external types are selected, hide all external objects
    if (availableExternalTypes.length > 0) {
      if (selectedExternalTypes.length === 0) {
        // Hide all external objects
        result = result.filter(n => !n.is_external);
      } else if (selectedExternalTypes.length < availableExternalTypes.length) {
        // Only show selected external types
        result = result.filter(n => {
          if (!n.is_external) return true;
          return n.external_ref_type && selectedExternalTypes.includes(n.external_ref_type);
        });
      }
    }

    // Filter by exclude patterns
    if (filterConfig.excludePatterns.length > 0) {
      const patterns = filterConfig.excludePatterns.map(p => {
        // Convert wildcard pattern to regex
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexStr = escaped.replace(/\\\*/g, '.*');
        return new RegExp(regexStr, 'i');
      });

      result = result.filter(n => {
        const fullName = `${n.schema}.${n.name}`;
        return !patterns.some(p => p.test(fullName) || p.test(n.name));
      });
    }

    // Hide isolated nodes using graphology's neighbors()
    if (filterConfig.hideIsolated) {
      const nodeIds = new Set(result.map(n => n.id));
      result = result.filter(n =>
        lineageGraph.hasNode(n.id) &&
        lineageGraph.neighbors(n.id).some(id => nodeIds.has(id))
      );
    }

    return result;
  }, [allNodes, filterConfig, availableSchemas.length, availableObjectTypes.length, selectedDataModelTypes, availableDataModelTypes.length, nodeClassifications, selectedExternalTypes, availableExternalTypes.length, lineageGraph]);

  // Focus schema filtering: show focus schema nodes + their direct neighbors only (1-hop)
  // This removes islands/orphans from neighbor schemas that aren't connected to focus
  const focusFilteredNodes = useMemo(() => {
    if (!focusSchema) return filteredNodes;
    if (!lineageGraph || lineageGraph.order === 0) return filteredNodes;

    // Get all focus schema node IDs
    const focusNodeIds = new Set(
      filteredNodes.filter(n => n.schema === focusSchema).map(n => n.id)
    );

    // Get direct neighbors (1-hop) using graphology
    const directNeighborIds = new Set<string>();
    for (const nodeId of focusNodeIds) {
      if (lineageGraph.hasNode(nodeId)) {
        lineageGraph.forEachNeighbor(nodeId, (neighborId) => {
          directNeighborIds.add(neighborId);
        });
      }
    }

    // Show: focus schema nodes + their direct neighbors
    return filteredNodes.filter(n =>
      focusNodeIds.has(n.id) || directNeighborIds.has(n.id)
    );
  }, [filteredNodes, focusSchema, lineageGraph]);

  // Search results - search within focus-filtered nodes when active
  // Uses debounced search term to prevent UI stuttering on large datasets
  // Includes external objects (searches by name which contains the path/URL)
  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }

    const term = debouncedSearchTerm.toLowerCase();
    return focusFilteredNodes
      .filter(n => {
        // For external objects, search only by name (which is the path/URL)
        if (n.is_external) {
          return n.name.toLowerCase().includes(term);
        }
        // For local objects, search by name, schema, or qualified name
        return (
          n.name.toLowerCase().includes(term) ||
          n.schema.toLowerCase().includes(term) ||
          `${n.schema}.${n.name}`.toLowerCase().includes(term)
        );
      })
      .slice(0, 10); // Limit results
  }, [focusFilteredNodes, debouncedSearchTerm]);

  // Handle focus schema change: auto-select neighbor schemas and set focus
  const handleSetFocusSchema = useCallback((schema: string | null) => {
    isUserChange.current = true;

    if (!schema) {
      // Clear focus - don't change schema selection
      setFocusSchemaState(null);
      return;
    }

    // Find all schemas that have direct connections to the focus schema
    const focusNodes = allNodes.filter(n => n.schema === schema);
    const neighborSchemas = new Set<string>([schema]);

    for (const node of focusNodes) {
      if (lineageGraph.hasNode(node.id)) {
        lineageGraph.forEachNeighbor(node.id, (neighborId) => {
          const neighborNode = allNodes.find(n => n.id === neighborId);
          if (neighborNode?.schema) {
            neighborSchemas.add(neighborNode.schema);
          }
        });
      }
    }

    // Auto-select the focus schema + neighbor schemas
    setFilterConfig(prev => ({
      ...prev,
      selectedSchemas: Array.from(neighborSchemas),
    }));

    setFocusSchemaState(schema);
  }, [allNodes, lineageGraph]);

  return {
    filterConfig,
    availableSchemas,
    availableObjectTypes,
    availableDataModelTypes,
    availableExternalTypes,
    filteredNodes: focusFilteredNodes, // Use focus-filtered result
    setSelectedSchemas,
    setSelectedObjectTypes,
    setSelectedDataModelTypes,
    setSelectedExternalTypes,
    setExcludePatterns,
    setHideIsolated,
    selectAllSchemas,
    selectNoSchemas,
    selectAllTypes,
    selectNoTypes,
    selectAllDataModelTypes,
    selectNoDataModelTypes,
    selectAllExternalTypes,
    selectNoExternalTypes,
    resetFilters,
    searchTerm,
    setSearchTerm,
    searchResults,
    layoutDirection,
    showMinimap,
    showControls,
    edgeType,
    focusSchema,
    setFocusSchema: handleSetFocusSchema,
    // Expose for toolbar badge
    selectedDataModelTypes,
    selectedExternalTypes,
  };
}
