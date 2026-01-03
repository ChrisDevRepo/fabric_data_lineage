/**
 * LineageLegend Component
 * Collapsible legend showing schema colors
 */

import React, { useState, useMemo } from 'react';
import {
  Button,
  Text,
} from '@fluentui/react-components';
import {
  ChevronDown16Regular,
  ChevronUp16Regular,
} from '@fluentui/react-icons';
import { getSchemaColorByName } from './useReactFlowTheme';

/** External type "schemas" that should not appear in the legend */
const EXTERNAL_TYPE_SCHEMAS = ['FILE', 'OTHER_DB', 'LINK'];

interface LineageLegendProps {
  schemas: string[];
  selectedSchemas: string[];
  compact?: boolean; // For minimal display
}

/**
 * Get a consistent color for a schema using centralized theme system.
 * Colors are deterministic based on schema name and adapt to light/dark mode.
 */
export function getSchemaColor(schema: string, _allSchemas?: string[]): string {
  return getSchemaColorByName(schema);
}

export function LineageLegend({ schemas, selectedSchemas, compact = false }: LineageLegendProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showAllSchemas, setShowAllSchemas] = useState(false);

  const displaySchemas = useMemo(() => {
    // Filter out external type "schemas" (FILE, OTHER_DB, LINK) - they have their own filter
    const visible = selectedSchemas
      .filter(s => schemas.includes(s))
      .filter(s => !EXTERNAL_TYPE_SCHEMAS.includes(s));
    const maxShow = compact ? 4 : 6;
    if (!showAllSchemas && visible.length > maxShow) {
      return visible.slice(0, maxShow);
    }
    return visible;
  }, [schemas, selectedSchemas, showAllSchemas, compact]);

  // Count only non-external schemas that are hidden (not shown due to maxShow limit)
  const visibleLocalSchemas = selectedSchemas
    .filter(s => schemas.includes(s))
    .filter(s => !EXTERNAL_TYPE_SCHEMAS.includes(s));
  const hiddenCount = visibleLocalSchemas.length - displaySchemas.length;

  return (
    <div className="lineage-legend">
      <Button
        appearance="subtle"
        size="small"
        className="lineage-legend__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        icon={isExpanded ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
        iconPosition="after"
      >
        Legend
      </Button>

      {isExpanded && (
        <div className="lineage-legend__content">
          <div className="lineage-legend__items">
            {displaySchemas.map(schema => (
              <div key={schema} className="lineage-legend__item">
                <span
                  className="lineage-legend__color"
                  style={{ backgroundColor: getSchemaColor(schema, schemas) }}
                />
                <Text size={200}>{schema}</Text>
              </div>
            ))}
            {hiddenCount > 0 && !showAllSchemas && (
              <Button
                appearance="transparent"
                size="small"
                onClick={() => setShowAllSchemas(true)}
                className="lineage-legend__more"
              >
                +{hiddenCount} more
              </Button>
            )}
            {showAllSchemas && selectedSchemas.length > (compact ? 4 : 6) && (
              <Button
                appearance="transparent"
                size="small"
                onClick={() => setShowAllSchemas(false)}
                className="lineage-legend__more"
              >
                Show less
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
