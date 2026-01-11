/**
 * DataLineageSearchOverlay Component
 *
 * Full-screen DDL search overlay with resizable split panels.
 * Top panel: Search results list
 * Bottom panel: Monaco editor with selected DDL
 *
 * Rendered as a simple overlay controlled by isOpen prop.
 * No Fabric panel API, no routing, no URL changes.
 * Same pattern as DDLViewerPanel - just React state.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { SearchResult, LineageService } from './LineageService';
import { SearchResultsList } from './SearchResultsList';
import { DDLViewer } from './DDLViewer';
import {
  DETAIL_SEARCH_HEIGHT_DEFAULT_PCT,
  DETAIL_SEARCH_HEIGHT_MIN_PCT,
  DETAIL_SEARCH_HEIGHT_MAX_PCT,
} from './monacoConfig';
import './DataLineageItem.scss';

export interface SearchOverlayFilters {
  schemas: string[];
  selectedSchemas: string[];
  selectedTypes: string[];
  sourceId?: number;
}

export interface DataLineageSearchOverlayProps {
  /** Whether the overlay is visible */
  isOpen: boolean;
  /** Callback when user clicks back button */
  onClose: () => void;
  /** Callback when user wants to focus a node in the graph (optional) */
  onFocusNode?: (nodeId: string) => void;
  /** LineageService instance from editor */
  service: LineageService | null;
  /** Filter configuration from editor */
  filters: SearchOverlayFilters;
}

export function DataLineageSearchOverlay({
  isOpen,
  onClose,
  onFocusNode,
  service,
  filters,
}: DataLineageSearchOverlayProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter state - initialized from props
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());
  const availableTypes = ['Table', 'View', 'Stored Procedure', 'Function'];
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(availableTypes));
  const [activeSourceId, setActiveSourceId] = useState<number | undefined>(undefined);
  const [filtersReady, setFiltersReady] = useState(false);

  // Resizable panel state (percentage for results panel height)
  const [resultsPanelHeight, setResultsPanelHeight] = useState(DETAIL_SEARCH_HEIGHT_DEFAULT_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize filters from props when overlay opens
  useEffect(() => {
    if (isOpen && filters) {
      // Filter out empty schemas
      const validSchemas = filters.schemas.filter(s => s && s.trim().length > 0);
      setAvailableSchemas(validSchemas);

      const validSelected = filters.selectedSchemas.filter(s => s && s.trim().length > 0);
      setSelectedSchemas(new Set(validSelected.length > 0 ? validSelected : validSchemas));

      if (filters.selectedTypes.length > 0) {
        setSelectedTypes(new Set(filters.selectedTypes));
      }

      setActiveSourceId(filters.sourceId);
      setFiltersReady(true);
    }
  }, [isOpen, filters]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSubmittedQuery('');
      setResults([]);
      setSelectedResult(null);
      setSearchError(null);
      setFiltersReady(false);
    }
  }, [isOpen]);

  // Execute search
  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim() || !service) return;

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

      const searchResults = await service.searchDdl(
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
  }, [service, selectedSchemas, selectedTypes, availableSchemas.length, availableTypes.length, activeSourceId]);

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

  // Handle back navigation - just close overlay and optionally focus node
  const handleBack = useCallback(() => {
    if (selectedResult && onFocusNode) {
      const nodeId = `${selectedResult.source_id}_${selectedResult.object_id}`;
      onFocusNode(nodeId);
    }
    onClose();
  }, [selectedResult, onFocusNode, onClose]);

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

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="data-lineage-search data-lineage-search--overlay">
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

export default DataLineageSearchOverlay;
