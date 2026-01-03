/**
 * LineageToolbar Component
 * Provides search, filtering, and layout controls for the lineage graph
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Input,
  Checkbox,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Button,
  Text,
  Badge,
  Tooltip,
} from '@fluentui/react-components';
import {
  Search24Regular,
  ArrowReset24Regular,
  Eye24Regular,
  EyeOff24Regular,
  ChevronDown16Regular,
  BranchFork24Regular,
  Star24Regular,
  Star24Filled,
  Warning16Regular,
} from '@fluentui/react-icons';
import { DataNode, ObjectType, ExternalRefType } from './types';
import { UseLineageFiltersResult } from './useLineageFilters';
import { UseInteractiveTraceResult } from './useInteractiveTrace';
import { DataModelTypeRule } from './DataLineageItemDefinition';

/** Labels for external type checkboxes */
const EXTERNAL_TYPE_LABELS: Record<ExternalRefType, string> = {
  FILE: 'File Storage',
  OTHER_DB: 'Other Database',
  LINK: 'External Link',
};

interface LineageToolbarProps {
  filters: UseLineageFiltersResult;
  totalNodes: number;
  onFocusNode?: (nodeId: string) => void;
  /** Called when reset filters is clicked - centers view on hub node */
  onCenterOnHub?: () => void;
  trace?: UseInteractiveTraceResult;
  /** Number of objects hidden by exclude patterns */
  excludedCount?: number;
  /** Data model type rules for displaying in filter */
  dataModelTypes?: DataModelTypeRule[];
}

export function LineageToolbar({ filters, totalNodes, onFocusNode, onCenterOnHub, trace, excludedCount = 0, dataModelTypes = [] }: LineageToolbarProps) {
  const {
    filterConfig,
    availableSchemas,
    availableObjectTypes,
    availableDataModelTypes,
    availableExternalTypes,
    filteredNodes,
    setSelectedSchemas,
    setSelectedObjectTypes,
    setSelectedDataModelTypes,
    setSelectedExternalTypes,
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
    focusSchema,
    setFocusSchema,
    selectedDataModelTypes,
    selectedExternalTypes,
  } = filters;

  const [schemaPopoverOpen, setSchemaPopoverOpen] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Handle search result selection
  const handleSearchSelect = useCallback((node: DataNode) => {
    setSearchTerm('');
    setSearchFocused(false);
    if (onFocusNode) {
      onFocusNode(node.id);
    }
  }, [setSearchTerm, onFocusNode]);

  // Handle starting trace from search result
  const handleStartTrace = useCallback((node: DataNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    setSearchFocused(false);
    if (trace?.startTrace) {
      trace.startTrace(node.id, `${node.schema}.${node.name}`);
    }
  }, [setSearchTerm, trace]);

  // Handle schema checkbox change
  const handleSchemaChange = useCallback((schema: string, checked: boolean) => {
    if (checked) {
      setSelectedSchemas([...filterConfig.selectedSchemas, schema]);
    } else {
      setSelectedSchemas(filterConfig.selectedSchemas.filter(s => s !== schema));
      // Clear focus star if this schema was focused
      if (focusSchema === schema) {
        setFocusSchema(null);
      }
    }
  }, [filterConfig.selectedSchemas, setSelectedSchemas, focusSchema, setFocusSchema]);

  // Handle star click - toggle focus schema (only one at a time)
  // When starring: auto-selects focus schema + neighbor schemas, filters to direct connections
  // When unstarring: clears focus (keeps current schema selection)
  const handleStarClick = useCallback((schema: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent checkbox toggle
    if (focusSchema === schema) {
      // Unstar - remove focus (schema selection stays as-is)
      setFocusSchema(null);
    } else {
      // Star this schema - setFocusSchema will auto-select neighbor schemas
      setFocusSchema(schema);
    }
  }, [focusSchema, setFocusSchema]);

  // Handle type checkbox change
  const handleTypeChange = useCallback((type: ObjectType, checked: boolean) => {
    if (checked) {
      setSelectedObjectTypes([...filterConfig.selectedObjectTypes, type]);
    } else {
      setSelectedObjectTypes(filterConfig.selectedObjectTypes.filter(t => t !== type));
    }
  }, [filterConfig.selectedObjectTypes, setSelectedObjectTypes]);

  // Handle data model type checkbox change
  const handleDataModelTypeChange = useCallback((typeName: string, checked: boolean) => {
    if (checked) {
      setSelectedDataModelTypes([...selectedDataModelTypes, typeName]);
    } else {
      setSelectedDataModelTypes(selectedDataModelTypes.filter(t => t !== typeName));
    }
  }, [selectedDataModelTypes, setSelectedDataModelTypes]);

  // Handle external type checkbox change
  const handleExternalTypeChange = useCallback((type: ExternalRefType, checked: boolean) => {
    if (checked) {
      setSelectedExternalTypes([...selectedExternalTypes, type]);
    } else {
      setSelectedExternalTypes(selectedExternalTypes.filter(t => t !== type));
    }
  }, [selectedExternalTypes, setSelectedExternalTypes]);

  // Select all/none for combined types dropdown
  const selectAllCombinedTypes = useCallback(() => {
    selectAllTypes();
    selectAllDataModelTypes();
    selectAllExternalTypes();
  }, [selectAllTypes, selectAllDataModelTypes, selectAllExternalTypes]);

  const selectNoCombinedTypes = useCallback(() => {
    selectNoTypes();
    selectNoDataModelTypes();
    selectNoExternalTypes();
  }, [selectNoTypes, selectNoDataModelTypes, selectNoExternalTypes]);

  // Handle reset: clear all filters and center on hub node (like initial page load)
  const handleResetFilters = useCallback(() => {
    resetFilters();
    onCenterOnHub?.();
  }, [resetFilters, onCenterOnHub]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count for type filter badge (object types + data model types + external types)
  // Only count selected items that exist in available lists (avoid stale state issues)
  const totalTypeCount = availableObjectTypes.length + availableDataModelTypes.length + availableExternalTypes.length;
  const validSelectedObjectTypes = filterConfig.selectedObjectTypes.filter(t => availableObjectTypes.includes(t));
  const validSelectedDataModelTypes = selectedDataModelTypes.filter(t => availableDataModelTypes.includes(t));
  const validSelectedExternalTypes = selectedExternalTypes.filter(t => availableExternalTypes.includes(t));
  const selectedTypeCount = validSelectedObjectTypes.length + validSelectedDataModelTypes.length + validSelectedExternalTypes.length;
  const hasTypeFilter = selectedTypeCount < totalTypeCount;

  const activeFilterCount =
    (filterConfig.selectedSchemas.length < availableSchemas.length ? 1 : 0) +
    (hasTypeFilter ? 1 : 0) +
    (filterConfig.hideIsolated ? 1 : 0) +
    (focusSchema ? 1 : 0);

  return (
    <div className="lineage-toolbar">
      <Toolbar aria-label="Lineage controls" className="lineage-toolbar__main">
        {/* Stats - inline on left */}
        <span className="lineage-toolbar__stats-inline">
          <Text size={200}>
            <strong>{filteredNodes.length}</strong>/<strong>{totalNodes}</strong>
          </Text>
          {activeFilterCount > 0 && (
            <Badge appearance="tint" size="small" color="brand">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </Badge>
          )}
          {excludedCount > 0 && (
            <Tooltip content={`${excludedCount} objects hidden by exclude patterns`} relationship="label">
              <Badge appearance="tint" size="small" color="warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Warning16Regular style={{ fontSize: 12 }} />
                {excludedCount} excluded
              </Badge>
            </Tooltip>
          )}
        </span>

        <ToolbarDivider />

        {/* Search */}
        <div className="lineage-toolbar__search" ref={searchRef}>
          <Input
            contentBefore={<Search24Regular />}
            placeholder="Search objects..."
            value={searchTerm}
            onChange={(_, data) => setSearchTerm(data.value)}
            onFocus={() => setSearchFocused(true)}
            className="lineage-toolbar__search-input"
          />
          {searchFocused && searchResults.length > 0 && (
            <div className="lineage-toolbar__search-results">
              {searchResults.map(node => (
                <div
                  key={node.id}
                  className="lineage-toolbar__search-result"
                  onClick={() => handleSearchSelect(node)}
                >
                  <div className="lineage-toolbar__search-result-content">
                    <Text weight="semibold">{node.name}</Text>
                    <Text size={200} className="lineage-toolbar__search-result-meta">
                      {node.schema} • {node.object_type}
                    </Text>
                  </div>
                  {trace && node.object_type !== 'External' && (
                    <Tooltip content="Trace lineage from this node" relationship="label">
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<BranchFork24Regular />}
                        onClick={(e: React.MouseEvent) => handleStartTrace(node, e)}
                        className="lineage-toolbar__search-result-trace"
                      />
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <ToolbarDivider />

        {/* Schema Filter */}
        <Popover
          open={schemaPopoverOpen}
          onOpenChange={(_, data) => setSchemaPopoverOpen(data.open)}
        >
          <PopoverTrigger disableButtonEnhancement>
            <Tooltip content="Filter by schema" relationship="label">
              <ToolbarButton
                appearance={filterConfig.selectedSchemas.length < availableSchemas.length ? 'primary' : 'subtle'}
              >
                Schemas
                <Badge
                  appearance="filled"
                  size="small"
                  className="lineage-toolbar__badge"
                >
                  {filterConfig.selectedSchemas.length}/{availableSchemas.length}
                </Badge>
                <ChevronDown16Regular />
              </ToolbarButton>
            </Tooltip>
          </PopoverTrigger>
          <PopoverSurface className="lineage-toolbar__popover">
            <div className="lineage-toolbar__popover-header">
              <Text weight="semibold">Filter Schemas</Text>
              <div className="lineage-toolbar__popover-actions">
                <Button size="small" appearance="subtle" onClick={selectAllSchemas}>All</Button>
                <Button size="small" appearance="subtle" onClick={selectNoSchemas}>None</Button>
              </div>
            </div>
            <div className="lineage-toolbar__popover-list">
              {availableSchemas.map(schema => (
                <div key={schema} className="lineage-toolbar__schema-row">
                  <Tooltip
                    content={focusSchema === schema ? "Remove focus" : "Set as focus schema"}
                    relationship="label"
                  >
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={focusSchema === schema ? <Star24Filled /> : <Star24Regular />}
                      onClick={(e: React.MouseEvent) => handleStarClick(schema, e)}
                      className="lineage-toolbar__star-btn"
                      aria-pressed={focusSchema === schema}
                      style={{
                        color: focusSchema === schema ? 'var(--colorPaletteYellowForeground1)' : undefined,
                        minWidth: 24,
                        padding: 0,
                      }}
                    />
                  </Tooltip>
                  <Checkbox
                    label={schema}
                    checked={filterConfig.selectedSchemas.includes(schema)}
                    onChange={(_, data) => handleSchemaChange(schema, data.checked as boolean)}
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
            </div>
          </PopoverSurface>
        </Popover>

        {/* Type Filter - Combined dropdown with Object Types and Data Model Types */}
        <Popover
          open={typePopoverOpen}
          onOpenChange={(_, data) => setTypePopoverOpen(data.open)}
        >
          <PopoverTrigger disableButtonEnhancement>
            <Tooltip content="Filter by type" relationship="label">
              <ToolbarButton
                appearance={hasTypeFilter ? 'primary' : 'subtle'}
              >
                Types
                <Badge
                  appearance="filled"
                  size="small"
                  className="lineage-toolbar__badge"
                >
                  {selectedTypeCount}/{totalTypeCount}
                </Badge>
                <ChevronDown16Regular />
              </ToolbarButton>
            </Tooltip>
          </PopoverTrigger>
          <PopoverSurface className="lineage-toolbar__popover lineage-toolbar__popover--wide">
            <div className="lineage-toolbar__popover-header">
              <Text weight="semibold">Filter Types</Text>
              <div className="lineage-toolbar__popover-actions">
                <Button size="small" appearance="subtle" onClick={selectAllCombinedTypes}>All</Button>
                <Button size="small" appearance="subtle" onClick={selectNoCombinedTypes}>None</Button>
              </div>
            </div>

            {/* Object Types Section */}
            <div className="lineage-toolbar__popover-section">
              <Text size={200} weight="semibold" className="lineage-toolbar__section-header">
                OBJECT TYPES
              </Text>
              <div className="lineage-toolbar__popover-list">
                {availableObjectTypes.map(type => (
                  <Checkbox
                    key={type}
                    label={type}
                    checked={filterConfig.selectedObjectTypes.includes(type)}
                    onChange={(_, data) => handleTypeChange(type, data.checked as boolean)}
                  />
                ))}
              </div>
            </div>

            {/* Divider between sections */}
            {availableDataModelTypes.length > 0 && (
              <div className="lineage-toolbar__popover-divider" />
            )}

            {/* Data Model Types Section */}
            {availableDataModelTypes.length > 0 && (
              <div className="lineage-toolbar__popover-section">
                <Text size={200} weight="semibold" className="lineage-toolbar__section-header">
                  DATA MODEL TYPES
                </Text>
                <div className="lineage-toolbar__popover-list">
                  {availableDataModelTypes.map(typeName => (
                    <Checkbox
                      key={typeName}
                      label={typeName}
                      checked={selectedDataModelTypes.includes(typeName)}
                      onChange={(_, data) => handleDataModelTypeChange(typeName, data.checked as boolean)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Divider before external types */}
            {availableExternalTypes.length > 0 && (
              <div className="lineage-toolbar__popover-divider" />
            )}

            {/* External Types Section */}
            {availableExternalTypes.length > 0 && (
              <div className="lineage-toolbar__popover-section">
                <Text size={200} weight="semibold" className="lineage-toolbar__section-header">
                  EXTERNAL TYPES
                </Text>
                <div className="lineage-toolbar__popover-list">
                  {availableExternalTypes.map(type => (
                    <Checkbox
                      key={type}
                      label={EXTERNAL_TYPE_LABELS[type]}
                      checked={selectedExternalTypes.includes(type)}
                      onChange={(_, data) => handleExternalTypeChange(type, data.checked as boolean)}
                    />
                  ))}
                </div>
              </div>
            )}
          </PopoverSurface>
        </Popover>

        <ToolbarDivider />

        {/* Hide Isolated Toggle */}
        <Tooltip content={filterConfig.hideIsolated ? "Show isolated nodes" : "Hide isolated nodes"} relationship="label">
          <ToolbarButton
            icon={filterConfig.hideIsolated ? <EyeOff24Regular /> : <Eye24Regular />}
            appearance={filterConfig.hideIsolated ? 'primary' : 'subtle'}
            onClick={() => setHideIsolated(!filterConfig.hideIsolated)}
          />
        </Tooltip>

        <ToolbarDivider />

        {/* Reset */}
        <Tooltip content="Reset all filters" relationship="label">
          <ToolbarButton
            icon={<ArrowReset24Regular />}
            onClick={handleResetFilters}
            disabled={activeFilterCount === 0 && !searchTerm}
          />
        </Tooltip>

        {/* Trace mode indicator */}
        {trace?.isTraceModeActive && (
          <>
            <ToolbarDivider />
            <Badge appearance="filled" color="informative" size="small">
              <BranchFork24Regular style={{ width: 12, height: 12, marginRight: 4 }} />
              Trace
            </Badge>
          </>
        )}
      </Toolbar>
    </div>
  );
}
