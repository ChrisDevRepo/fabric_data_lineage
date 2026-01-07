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
import { useParams, useHistory } from 'react-router-dom';
import {
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Checkbox,
  Text,
  Tooltip,
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

// Available object types for filtering (excluding Table as it has no DDL)
const OBJECT_TYPES = ['View', 'Stored Procedure', 'Function'];

export function DataLineageSearchPage({ workloadClient }: PageProps) {
  const { itemObjectId } = useParams<ContextProps>();
  const history = useHistory();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter state
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(OBJECT_TYPES));

  // Resizable panel state (percentage for results panel height)
  const [resultsPanelHeight, setResultsPanelHeight] = useState(DETAIL_SEARCH_HEIGHT_DEFAULT_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Service ref
  const serviceRef = useRef<ReturnType<typeof createLineageService> | null>(null);

  // Initialize service (load item definition to get endpoint) and load available schemas
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

        // Warm-up: Fire-and-forget query to wake up SQL database
        serviceRef.current.getSources().catch(() => {});

        // Load schemas for filter dropdown
        const objects = await serviceRef.current.getObjects();
        const schemas = [...new Set(objects.map((o) => o.schema_name))].sort();
        setAvailableSchemas(schemas);
        setSelectedSchemas(new Set(schemas)); // Select all by default
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
      const schemasFilter = selectedSchemas.size < availableSchemas.length
        ? [...selectedSchemas].join(',')
        : undefined;
      const typesFilter = selectedTypes.size < OBJECT_TYPES.length
        ? [...selectedTypes].join(',')
        : undefined;

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
  }, [selectedSchemas, selectedTypes, availableSchemas.length]);

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

  // Handle back navigation - navigate to editor with focusNode param if object selected
  const handleBack = useCallback(() => {
    if (!itemObjectId) {
      console.error('Cannot navigate back: itemObjectId is missing from route');
      return;
    }

    const editorPath = `/DataLineageItem-editor/${itemObjectId}`;

    if (selectedResult) {
      // Build node ID in the format used by ReactFlow: {source_id}_{object_id}
      const nodeId = `${selectedResult.source_id}_${selectedResult.object_id}`;
      history.push(`${editorPath}?focusNode=${encodeURIComponent(nodeId)}`);
    } else {
      history.push(editorPath);
    }
  }, [history, itemObjectId, selectedResult]);

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
    setSelectedSchemas((prev) => {
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
    setSelectedTypes((prev) => {
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
    setSelectedTypes(new Set(OBJECT_TYPES));
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

          {/* Schema filter */}
          <Popover>
            <PopoverTrigger>
              <Tooltip content="Filter by schema" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Database24Regular />}
                >
                  Schemas ({selectedSchemas.size}/{availableSchemas.length})
                </Button>
              </Tooltip>
            </PopoverTrigger>
            <PopoverSurface className="data-lineage-search__filter-popover">
              <div className="filter-popover-header">
                <Text weight="semibold">Schemas</Text>
                <div className="filter-popover-actions">
                  <Button size="small" appearance="subtle" onClick={selectAllSchemas}>
                    All
                  </Button>
                  <Button size="small" appearance="subtle" onClick={selectNoSchemas}>
                    None
                  </Button>
                </div>
              </div>
              <div className="filter-popover-list">
                {availableSchemas.map((schema) => (
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

          {/* Type filter */}
          <Popover>
            <PopoverTrigger>
              <Tooltip content="Filter by object type" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Code24Regular />}
                >
                  Types ({selectedTypes.size}/{OBJECT_TYPES.length})
                </Button>
              </Tooltip>
            </PopoverTrigger>
            <PopoverSurface className="data-lineage-search__filter-popover">
              <div className="filter-popover-header">
                <Text weight="semibold">Object Types</Text>
                <div className="filter-popover-actions">
                  <Button size="small" appearance="subtle" onClick={selectAllTypes}>
                    All
                  </Button>
                  <Button size="small" appearance="subtle" onClick={selectNoTypes}>
                    None
                  </Button>
                </div>
              </div>
              <div className="filter-popover-list">
                {OBJECT_TYPES.map((type) => (
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
