/**
 * DataLineageSearchPage Component
 *
 * Full-page DDL search with resizable split panels.
 * Top panel: Search results list
 * Bottom panel: Monaco editor with selected DDL
 *
 * Opened via page.open() from ribbon button or context menu.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Input,
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  Search24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
} from '@fluentui/react-icons';
import { PageProps } from '../../App';
import { getWorkloadItem } from '../../controller/ItemCRUDController';
import { callPanelClose } from '../../controller/PanelController';
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

  // Filter state (synced from editor via sessionStorage)
  const [selectedSchemas, setSelectedSchemas] = useState<string[] | undefined>(undefined);
  const [selectedTypes, setSelectedTypes] = useState<string[] | undefined>(undefined);

  // Resizable panel state (percentage for results panel height)
  const [resultsPanelHeight, setResultsPanelHeight] = useState(DETAIL_SEARCH_HEIGHT_DEFAULT_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Service ref
  const serviceRef = useRef<ReturnType<typeof createLineageService> | null>(null);

  // Initialize service and load filters from editor
  useEffect(() => {
    if (!workloadClient) return;

    const initializeService = async () => {
      try {
        // Load item definition to get GraphQL endpoint
        let graphqlEndpoint: string | undefined;

        if (itemObjectId && itemObjectId !== 'demo') {
          const loadedItem = await getWorkloadItem<DataLineageItemDefinition>(
            workloadClient,
            itemObjectId,
            DEFAULT_DEFINITION
          );
          const definition = mergeWithDefaults(loadedItem.definition || {});
          graphqlEndpoint = definition.graphqlEndpoint;
        }

        // Create service with endpoint from item definition
        serviceRef.current = createLineageService(workloadClient, graphqlEndpoint);

        // Load filters synced from editor (if available)
        const savedFilters = sessionStorage.getItem(SEARCH_FILTERS_KEY);
        if (savedFilters) {
          sessionStorage.removeItem(SEARCH_FILTERS_KEY);
          const { selectedSchemas: selSchemas, selectedTypes: selTypes } = JSON.parse(savedFilters);
          if (selSchemas?.length) setSelectedSchemas(selSchemas);
          if (selTypes?.length) setSelectedTypes(selTypes);
        }
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
      // Pass filters from editor (undefined = search all)
      const schemasFilter = selectedSchemas?.join(',');
      const typesFilter = selectedTypes?.join(',');

      const searchResults = await serviceRef.current.searchDdl(
        query.trim(),
        schemasFilter,
        typesFilter
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
  }, [selectedSchemas, selectedTypes]);

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

  // Handle back navigation - close panel and optionally focus on selected node
  const handleBack = useCallback(async () => {
    // Store focus node in sessionStorage (editor checks this after panel closes)
    if (selectedResult) {
      const nodeId = `${selectedResult.source_id}_${selectedResult.object_id}`;
      sessionStorage.setItem(PENDING_FOCUS_NODE_KEY, nodeId);
    }
    await callPanelClose(workloadClient);
  }, [workloadClient, selectedResult]);

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
