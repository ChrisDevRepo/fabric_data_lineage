/**
 * SearchResultsList Component
 *
 * Displays search results from sp_search_ddl stored procedure.
 * Shows object name, type, schema, and snippet with search term highlighted.
 */

import React, { useMemo } from 'react';
import {
  Text,
  tokens,
  Spinner,
  Badge,
} from '@fluentui/react-components';
import {
  Table24Regular,
  Eye24Regular,
  Code24Regular,
  MathSymbols24Regular,
  Checkmark16Regular,
} from '@fluentui/react-icons';
import { SearchResult } from './LineageService';
import { getObjectTypeConfig } from './monacoConfig';

export interface SearchResultsListProps {
  /** Search results from API */
  results: SearchResult[];
  /** Currently selected result */
  selectedResult: SearchResult | null;
  /** Callback when a result is clicked */
  onSelectResult: (result: SearchResult) => void;
  /** Search query (for highlighting) */
  searchQuery: string;
  /** Whether search is in progress */
  isLoading?: boolean;
  /** Error message if search failed */
  error?: string | null;
}

// Object type icon mapping
const TYPE_ICONS: Record<string, React.ElementType> = {
  Table: Table24Regular,
  View: Eye24Regular,
  'Stored Procedure': Code24Regular,
  Function: MathSymbols24Regular,
};

/**
 * Highlight search term in text
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return (
    <>
      {before}
      <mark
        style={{
          backgroundColor: tokens.colorPaletteYellowBackground2,
          color: 'inherit',
          padding: '0 2px',
          borderRadius: '2px',
        }}
      >
        {match}
      </mark>
      {after}
    </>
  );
}

export function SearchResultsList({
  results,
  selectedResult,
  onSelectResult,
  searchQuery,
  isLoading = false,
  error = null,
}: SearchResultsListProps) {
  // Get theme-aware colors (called once per render, not per result)
  const objectTypeConfig = getObjectTypeConfig();

  // Memoize result rendering for performance
  const renderedResults = useMemo(() => {
    return results.map((result) => {
      const isSelected = selectedResult?.object_id === result.object_id;
      const Icon = TYPE_ICONS[result.object_type] || Code24Regular;
      const typeConfig = objectTypeConfig[result.object_type];

      return (
        <div
          key={`${result.source_id}_${result.object_id}`}
          className={`data-lineage-search__result ${isSelected ? 'data-lineage-search__result--selected' : ''}`}
          onClick={() => onSelectResult(result)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectResult(result);
            }
          }}
        >
          {/* Selected indicator */}
          {isSelected && (
            <div className="data-lineage-search__result-check">
              <Checkmark16Regular />
            </div>
          )}

          {/* Icon */}
          <div
            className="data-lineage-search__result-icon"
            style={{ color: typeConfig?.color || tokens.colorNeutralForeground2 }}
          >
            <Icon />
          </div>

          {/* Content */}
          <div className="data-lineage-search__result-content">
            {/* Object name with highlight */}
            <div className="data-lineage-search__result-name">
              <Text weight="semibold">
                {highlightText(result.object_name, searchQuery)}
              </Text>
              <Badge
                size="small"
                appearance="outline"
                style={{
                  marginLeft: tokens.spacingHorizontalS,
                  borderColor: typeConfig?.color,
                  color: typeConfig?.color,
                }}
              >
                {result.object_type}
              </Badge>
            </div>

            {/* Schema */}
            <Text
              size={200}
              style={{ color: tokens.colorNeutralForeground3 }}
            >
              {result.schema_name}
            </Text>

            {/* Snippet with highlight */}
            {result.snippet && (
              <div className="data-lineage-search__result-snippet">
                <Text
                  size={200}
                  style={{
                    color: tokens.colorNeutralForeground2,
                    fontFamily: 'var(--fontFamilyMonospace)',
                  }}
                >
                  {highlightText(result.snippet, searchQuery)}
                </Text>
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [results, selectedResult, searchQuery, onSelectResult, objectTypeConfig]);

  // Loading state
  if (isLoading) {
    return (
      <div className="data-lineage-search__results-empty">
        <Spinner size="medium" label="Searching..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="data-lineage-search__results-empty">
        <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
          {error}
        </Text>
      </div>
    );
  }

  // Empty state (no search yet)
  if (results.length === 0 && !searchQuery) {
    return (
      <div className="data-lineage-search__results-empty">
        <Text style={{ color: tokens.colorNeutralForeground3 }}>
          Enter a search term and press Enter
        </Text>
      </div>
    );
  }

  // No results
  if (results.length === 0 && searchQuery) {
    return (
      <div className="data-lineage-search__results-empty">
        <Text style={{ color: tokens.colorNeutralForeground3 }}>
          No results found for "{searchQuery}"
        </Text>
      </div>
    );
  }

  // Results list
  return (
    <div className="data-lineage-search__results-list">
      {renderedResults}
    </div>
  );
}

export default SearchResultsList;
