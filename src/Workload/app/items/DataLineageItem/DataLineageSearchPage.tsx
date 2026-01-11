/**
 * DataLineageSearchPage Component
 *
 * Full-page DDL search with resizable split panels.
 * Top panel: Search results list
 * Bottom panel: Monaco editor with selected DDL
 *
 * Opened via panel.open() from ribbon button or context menu.
 * Uses full window width to simulate page experience while using reliable panel API.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Input,
  Text,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Checkbox,
  tokens,
} from '@fluentui/react-components';
import {
  Search24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  Database24Regular,
  Code24Regular,
} from '@fluentui/react-icons';
import { PageProps } from '../../App';
import { getWorkloadItem } from '../../controller/ItemCRUDController';
import { callPanelCloseAndNavigateBack } from '../../controller/PanelController';
import { createLineageService, SearchResult } from './LineageService';
import { DataLineageItemDefinition, DEFAULT_DEFINITION, mergeWithDefaults } from './DataLineageItemDefinition';
import { SearchResultsList } from './SearchResultsList';
import { DDLViewer } from './DDLViewer';
import {
  DETAIL_SEARCH_HEIGHT_DEFAULT_PCT,
  DETAIL_SEARCH_HEIGHT_MIN_PCT,
  DETAIL_SEARCH_HEIGHT_MAX_PCT,
} from './monacoConfig';
import './DataLineageItem.scss';

interface ContextProps {
  itemObjectId: string;
}

// SessionStorage keys for panel-editor communication
export const PENDING_FOCUS_NODE_KEY = 'datalineage:pendingFocusNode';
export const SEARCH_FILTERS_KEY = 'datalineage:searchFilters';

export function DataLineageSearchPage({ workloadClient }: PageProps) {
  const { itemObjectId } = useParams<ContextProps>();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter state
  const [filtersReady, setFiltersReady] = useState(false);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());
  const availableTypes = ['Table', 'View', 'Stored Procedure', 'Function'];
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['Table', 'View', 'Stored Procedure', 'Function']));

  // Resizable panel state (percentage for results panel height)
  const [resultsPanelHeight, setResultsPanelHeight] = useState(DETAIL_SEARCH_HEIGHT_DEFAULT_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Service ref
  const serviceRef = useRef<ReturnType<typeof createLineageService> | null>(null);

  // Source ID from editor (for correct database context)
  const [activeSourceId, setActiveSourceId] = useState<number | undefined>(undefined);

  // Initialize service and load filters from editor
  // Uses sessionStorage data passed from editor to avoid slow Fabric API calls
  useEffect(() => {
    if (!workloadClient) return;

    const initializeService = async () => {
      try {
        let graphqlEndpoint: string | undefined;

        // Try to get data from sessionStorage (passed by editor)
        let schemasFromStorage: string[] | undefined;
        let selectedSchemasFromStorage: string[] | undefined;
        let selectedTypesFromStorage: string[] | undefined;
        let sourceIdFromStorage: number | undefined;

        const savedFilters = sessionStorage.getItem(SEARCH_FILTERS_KEY);
        if (savedFilters) {
          sessionStorage.removeItem(SEARCH_FILTERS_KEY);
          const parsed = JSON.parse(savedFilters);
          graphqlEndpoint = parsed.graphqlEndpoint;
          schemasFromStorage = parsed.schemas;
          selectedSchemasFromStorage = parsed.selectedSchemas;
          selectedTypesFromStorage = parsed.selectedTypes;
          sourceIdFromStorage = parsed.activeSourceId;
        }

        // Fallback: load from item definition if endpoint not in sessionStorage
        if (!graphqlEndpoint && itemObjectId && itemObjectId !== 'demo') {
          const loadedItem = await getWorkloadItem<DataLineageItemDefinition>(
            workloadClient,
            itemObjectId,
            DEFAULT_DEFINITION
          );
          const definition = mergeWithDefaults(loadedItem.definition || {});
          graphqlEndpoint = definition.graphqlEndpoint;
        }

        // Create service with endpoint
        serviceRef.current = createLineageService(workloadClient, graphqlEndpoint);

        // Set filters from editor (no fallback - must come from sessionStorage)
        if (schemasFromStorage?.length) {
          // Filter out empty schemas (external objects have schema='')
          const filteredSchemas = schemasFromStorage.filter(s => s && s.trim().length > 0);
          setAvailableSchemas(filteredSchemas);
          const filteredSelected = selectedSchemasFromStorage?.filter(s => s && s.trim().length > 0);
          setSelectedSchemas(new Set(filteredSelected?.length ? filteredSelected : filteredSchemas));
        }
        if (selectedTypesFromStorage?.length) {
          setSelectedTypes(new Set(selectedTypesFromStorage));
        }
        if (sourceIdFromStorage !== undefined) {
          setActiveSourceId(sourceIdFromStorage);
        }
        setFiltersReady(true);
      } catch (err) {
        console.error('Failed to initialize search service:', err);
        setSearchError(err instanceof Error ? err.message : 'Failed to initialize search');
      }
    };

    initializeService();
  }, [workloadClient, itemObjectId]);

  // Execute search
  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim() || !serviceRef.current) return;

    setIsSearching(true);
    setSearchError(null);
    setSubmittedQuery(query);

    try {
      // Convert Sets to comma-separated strings for API (undefined = search all)
      const schemasFilter = selectedSchemas.size < availableSchemas.length
        ? [...selectedSchemas].join(',')
        : undefined;
      const typesFilter = selectedTypes.size < availableTypes.length
        ? [...selectedTypes].join(',')
        : undefined;

      const searchResults = await serviceRef.current.searchDdl(
        query.trim(),
        schemasFilter,
        typesFilter,
        activeSourceId
      );

      setResults(searchResults);

      // Auto-select first result
      if (searchResults.length > 0) {
        setSelectedResult(searchResults[0]);
      } else {
        setSelectedResult(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setSearchError(errorMsg);
      setResults([]);
      setSelectedResult(null);
    } finally {
      setIsSearching(false);
    }
  }, [selectedSchemas, selectedTypes, availableSchemas.length, availableTypes.length, activeSourceId]);

  // Handle search submit (Enter key)
  const handleSearchSubmit = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch(searchQuery);
    }
  }, [searchQuery, executeSearch]);

  // Handle search button click
  const handleSearchClick = useCallback(() => {
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
    setResults([]);
    setSelectedResult(null);
    setSearchError(null);
  }, []);

  // Handle result selection
  const handleSelectResult = useCallback((result: SearchResult) => {
    setSelectedResult(result);
  }, []);

  // Handle back navigation - close panel, navigate to editor, and optionally focus on selected node
  const handleBack = useCallback(async () => {
    // Store focus node in sessionStorage (editor checks this after panel closes)
    if (selectedResult) {
      const nodeId = `${selectedResult.source_id}_${selectedResult.object_id}`;
      sessionStorage.setItem(PENDING_FOCUS_NODE_KEY, nodeId);
    }
    // Close panel and navigate back to editor to reset URL state
    // This prevents the second-open bug where Fabric falls back to production URL
    await callPanelCloseAndNavigateBack(workloadClient, itemObjectId);
  }, [workloadClient, selectedResult, itemObjectId]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const mouseY = e.clientY - containerRect.top;
      const percentage = (mouseY / containerHeight) * 100;

      // Clamp between min and max
      const clampedPercentage = Math.min(
        Math.max(percentage, DETAIL_SEARCH_HEIGHT_MIN_PCT),
        DETAIL_SEARCH_HEIGHT_MAX_PCT
      );

      setResultsPanelHeight(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Schema filter toggle
  const toggleSchema = useCallback((schema: string) => {
    setSelectedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schema)) {
        next.delete(schema);
      } else {
        next.add(schema);
      }
      return next;
    });
  }, []);

  // Type filter toggle
  const toggleType = useCallback((type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Select all/none for schemas
  const selectAllSchemas = useCallback(() => {
    setSelectedSchemas(new Set(availableSchemas));
  }, [availableSchemas]);

  const selectNoSchemas = useCallback(() => {
    setSelectedSchemas(new Set());
  }, []);

  // Select all/none for types
  const selectAllTypes = useCallback(() => {
    setSelectedTypes(new Set(availableTypes));
  }, []);

  const selectNoTypes = useCallback(() => {
    setSelectedTypes(new Set());
  }, []);

  return (
    <div className="data-lineage-search">
      {/* Header */}
      <div className="data-lineage-search__header">
        <div className="data-lineage-search__header-left">
          <Tooltip content="Back to graph" relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowLeft24Regular />}
              onClick={handleBack}
              aria-label="Back"
            />
          </Tooltip>
          <Text weight="semibold" size={400}>
            Detail Search
          </Text>
        </div>

        <div className="data-lineage-search__header-center">
          {/* Search input */}
          <div className="data-lineage-search__search-container">
            <Input
              className="data-lineage-search__search-input"
              placeholder="Search DDL definitions..."
              value={searchQuery}
              onChange={(e, data) => setSearchQuery(data.value)}
              onKeyDown={handleSearchSubmit}
              contentBefore={<Search24Regular />}
              contentAfter={
                searchQuery && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Dismiss24Regular />}
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                  />
                )
              }
            />
            <Button
              appearance="primary"
              onClick={handleSearchClick}
              disabled={!searchQuery.trim() || isSearching}
            >
              Search
            </Button>
          </div>

          {/* Schema filter - only show when filters are loaded */}
          {filtersReady && (
            <Popover>
              <PopoverTrigger>
                <Tooltip content="Filter by schema" relationship="label">
                  <Button appearance="subtle" icon={<Database24Regular />}>
                    Schemas ({selectedSchemas.size}/{availableSchemas.length})
                  </Button>
                </Tooltip>
              </PopoverTrigger>
              <PopoverSurface className="data-lineage-search__filter-popover">
                <div className="filter-popover-header">
                  <Text weight="semibold">Schemas</Text>
                  <div className="filter-popover-actions">
                    <Button size="small" appearance="subtle" onClick={selectAllSchemas}>All</Button>
                    <Button size="small" appearance="subtle" onClick={selectNoSchemas}>None</Button>
                  </div>
                </div>
                <div className="filter-popover-list">
                  {availableSchemas.map(schema => (
                    <Checkbox
                      key={schema}
                      label={schema}
                      checked={selectedSchemas.has(schema)}
                      onChange={() => toggleSchema(schema)}
                    />
                  ))}
                </div>
              </PopoverSurface>
            </Popover>
          )}

          {/* Type filter - only show when filters are loaded */}
          {filtersReady && (
            <Popover>
              <PopoverTrigger>
                <Tooltip content="Filter by object type" relationship="label">
                  <Button appearance="subtle" icon={<Code24Regular />}>
                    Types ({selectedTypes.size}/{availableTypes.length})
                  </Button>
                </Tooltip>
              </PopoverTrigger>
              <PopoverSurface className="data-lineage-search__filter-popover">
                <div className="filter-popover-header">
                  <Text weight="semibold">Object Types</Text>
                  <div className="filter-popover-actions">
                    <Button size="small" appearance="subtle" onClick={selectAllTypes}>All</Button>
                    <Button size="small" appearance="subtle" onClick={selectNoTypes}>None</Button>
                  </div>
                </div>
                <div className="filter-popover-list">
                  {availableTypes.map(type => (
                    <Checkbox
                      key={type}
                      label={type}
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                    />
                  ))}
                </div>
              </PopoverSurface>
            </Popover>
          )}
        </div>

        <div className="data-lineage-search__header-right">
          {results.length > 0 && (
            <Text style={{ color: tokens.colorNeutralForeground3 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
          )}
        </div>
      </div>

      {/* Main content - resizable panels */}
      <div
        ref={containerRef}
        className="data-lineage-search__content"
        style={{ cursor: isResizing ? 'ns-resize' : 'default' }}
      >
        {/* Results panel (top) */}
        <div
          className="data-lineage-search__results-panel"
          style={{ height: `${resultsPanelHeight}%` }}
        >
          <SearchResultsList
            results={results}
            selectedResult={selectedResult}
            onSelectResult={handleSelectResult}
            searchQuery={submittedQuery}
            isLoading={isSearching}
            error={searchError}
          />
        </div>

        {/* Resize handle */}
        <div
          className="data-lineage-search__resize-handle"
          onMouseDown={handleResizeStart}
        >
          <div className="data-lineage-search__resize-handle-bar" />
        </div>

        {/* DDL Viewer panel (bottom) */}
        <div
          className="data-lineage-search__ddl-panel"
          style={{ height: `${100 - resultsPanelHeight}%` }}
        >
          <DDLViewer
            ddlText={selectedResult?.ddl_text}
            objectName={selectedResult?.object_name}
            objectType={selectedResult?.object_type}
            schemaName={selectedResult?.schema_name}
            showHeader={true}
          />
        </div>
      </div>
    </div>
  );
}

export default DataLineageSearchPage;
