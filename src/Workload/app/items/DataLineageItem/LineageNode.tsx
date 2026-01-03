/**
 * Custom Node Component for ReactFlow
 * Renders a lineage object (Table, View, SP, Function)
 * Modern design with schema colors and object-type shapes
 * Includes rich tooltips with object details on hover
 */

import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Tooltip } from '@fluentui/react-components';
import {
  Link16Regular,
  // Shape icons for data model types (16px for compact display)
  // Regular (outline) icons
  Circle16Regular,
  // Filled icons for non-default types
  Square16Filled,
  Diamond16Filled,
  Triangle16Filled,
  Hexagon16Filled,
  Star16Filled,
} from '@fluentui/react-icons';
import { DataNode, ExternalRefType } from './types';
import { DataModelIcon } from './DataLineageItemDefinition';
import { getThemeColors } from './useReactFlowTheme';

/**
 * Icon component map for rendering shape icons in nodes
 * Uses Filled icons for all types except Circle (Other type stays outline)
 */
const ICON_COMPONENTS_16: Record<DataModelIcon, React.ComponentType> = {
  Circle: Circle16Regular,  // Other type stays outline
  Square: Square16Filled,
  Diamond: Diamond16Filled,
  Triangle: Triangle16Filled,
  Hexagon: Hexagon16Filled,
  Star: Star16Filled,
};

interface LineageNodeData extends DataNode {
  isSelected?: boolean;
  isHighlighted?: boolean;
  isTraced?: boolean;
  isDimmed?: boolean;
  isTraceStart?: boolean;
  schemaColor?: string;
  layoutDirection?: 'LR' | 'TB';
  nodeWidth?: number; // Calculated uniform width for all nodes
  // Data model classification
  dataModelType?: string;  // e.g., "Dimension", "Fact", "Other"
  dataModelIcon?: DataModelIcon;  // Shape icon for the type
  // External object properties
  isExternal?: boolean;  // Whether this is an external object
  externalRefType?: ExternalRefType;  // FILE, OTHER_DB, or LINK
  refName?: string;  // Full path/URL for external objects
}

/**
 * Get shape-specific border radius based on object type
 * - Table: Rectangle (solid border)
 * - View: Rectangle (dashed border)
 * - Stored Procedure: Oval/pill shape
 * - Function: Oval/pill shape
 */
const getNodeBorderRadius = (objectType: string): string => {
  switch (objectType) {
    case 'Table': return '4px';  // Rectangle with slight rounding
    case 'View': return '4px';   // Rectangle with slight rounding (dashed)
    case 'Stored Procedure': return '20px'; // Oval/pill shape
    case 'Function': return '20px'; // Oval/pill shape
    default: return '4px';
  }
};

/**
 * Check if object type uses dashed border
 * Only External objects use dashed border - Views now use solid border like Tables
 */
const usesDashedBorder = (objectType: string): boolean => {
  return objectType === 'External';
};

/**
 * Get type abbreviation for footer display
 * External objects show their ref type (FILE/DB/LINK) instead of object type
 */
const getTypeAbbrev = (objectType: string, externalRefType?: ExternalRefType): string => {
  // For external objects, show the ref type abbreviation
  if (objectType === 'External' && externalRefType) {
    switch (externalRefType) {
      case 'FILE': return 'FILE';
      case 'OTHER_DB': return 'DB';
      case 'LINK': return 'LINK';
      default: return 'EXT';
    }
  }
  // Local object types
  switch (objectType) {
    case 'Table': return 'TBL';
    case 'View': return 'VW';
    case 'Stored Procedure': return 'SP';
    case 'Function': return 'FN';
    default: return '';
  }
};

/**
 * Get display label for external ref type
 */
const getExternalTypeLabel = (refType?: ExternalRefType): string => {
  switch (refType) {
    case 'FILE': return 'External FILE';
    case 'OTHER_DB': return 'External Database';
    case 'LINK': return 'External Link';
    default: return 'External';
  }
};

/**
 * Truncate a path/URL for display in node footer
 * Shows last part of path, truncated with ellipsis if too long
 * @param path Full path/URL
 * @param maxLength Maximum characters to show (default 20)
 */
const truncatePath = (path: string | undefined, maxLength: number = 20): string => {
  if (!path) return '';

  // For abfss:// or similar URLs, extract the file/folder part
  // e.g., "abfss://container@account/folder/file.parquet" -> "folder/file.parquet"
  let displayPart = path;

  // Try to get the path after the container/domain
  const protocolMatch = path.match(/^(?:abfss?|https?|wasbs?):\/\/[^/]+\/(.+)$/i);
  if (protocolMatch) {
    displayPart = protocolMatch[1];
  }

  // If still too long, truncate with ellipsis
  if (displayPart.length > maxLength) {
    return '...' + displayPart.slice(-maxLength + 3);
  }

  return displayPart;
};

/**
 * Compact tooltip showing key node information
 * Visual hierarchy: Full name (primary) > Type/connections (secondary) > Metadata (tertiary)
 * Follows Fabric UX design tokens for spacing, typography, and colors
 *
 * External nodes show simplified tooltip: full path + external type label
 */
function NodeTooltipContent({ data }: { data: LineageNodeData }) {
  const inputCount = data.inputs?.length || 0;
  const outputCount = data.outputs?.length || 0;
  const IconComponent = data.dataModelIcon ? ICON_COMPONENTS_16[data.dataModelIcon] : null;

  // Inline style to force width (Fluent Tooltip wrapper constrains content)
  const tooltipStyle: React.CSSProperties = {
    width: 320,
    minWidth: 320,
  };

  // External nodes have simplified tooltip showing full path
  if (data.isExternal) {
    // Show full ref_name if available, otherwise fall back to name
    const fullPath = data.refName || data.ref_name || data.name;
    return (
      <div className="data-lineage-node-tooltip" style={tooltipStyle}>
        {/* Primary: Full path/URL for external objects */}
        <div className="data-lineage-node-tooltip__name" style={{ wordBreak: 'break-all' }}>
          {fullPath}
        </div>

        {/* Secondary: External type label */}
        <div className="data-lineage-node-tooltip__meta">
          <span className="data-lineage-node-tooltip__type">
            {getExternalTypeLabel(data.externalRefType)}
          </span>
        </div>
      </div>
    );
  }

  // Local object tooltip (existing logic)
  return (
    <div className="data-lineage-node-tooltip" style={tooltipStyle}>
      {/* Primary: Full qualified name */}
      <div className="data-lineage-node-tooltip__name">
        [{data.schema}].[{data.name}]
      </div>

      {/* Secondary: Object type and connection counts */}
      <div className="data-lineage-node-tooltip__meta">
        <span className="data-lineage-node-tooltip__type">{data.object_type}</span>
        <span className="data-lineage-node-tooltip__separator">·</span>
        <span className="data-lineage-node-tooltip__connections">
          <span title="Inputs (dependencies)">↓{inputCount}</span>
          <span title="Outputs (dependents)">↑{outputCount}</span>
        </span>
      </div>

      {/* Tertiary: Data model classification */}
      {data.dataModelType && (
        <div className="data-lineage-node-tooltip__classification">
          {IconComponent && <IconComponent />}
          <span>{data.dataModelType}</span>
        </div>
      )}

      {/* Status badges */}
      {data.isTraceStart && (
        <div className="data-lineage-node-tooltip__badges">
          <span className="data-lineage-node-tooltip__badge data-lineage-node-tooltip__badge--trace">
            Trace origin
          </span>
        </div>
      )}
    </div>
  );
}

function LineageNodeComponent({ data }: NodeProps<LineageNodeData>) {
  const isExternal = data.isExternal ?? false;

  // Build CSS classes for state-based styling
  const stateClasses = [
    'data-lineage-node',
    isExternal && 'data-lineage-node--external',
    data.isSelected && 'data-lineage-node--selected',
    data.isHighlighted && 'data-lineage-node--highlighted',
    data.isTraced && 'data-lineage-node--traced',
    data.isDimmed && 'data-lineage-node--dimmed',
    data.isTraceStart && 'data-lineage-node--trace-start',
  ].filter(Boolean).join(' ');

  // Calculate dynamic styles based on schema color and object type
  // External nodes have distinct styling: dashed border, transparent fill, no left bar
  const nodeStyles = useMemo(() => {
    const themeColors = getThemeColors();
    const schemaColor = data.schemaColor || themeColors.nodeFallbackColor;
    const borderRadius = getNodeBorderRadius(data.object_type);

    // External nodes: dashed border, transparent fill, no left bar
    if (isExternal) {
      return {
        borderRadius,
        backgroundColor: 'transparent',
        borderColor: 'var(--colorNeutralStroke2)',
        borderWidth: '1px',
        borderStyle: 'dashed',
        // No left bar for external nodes (CSS will hide ::before)
        '--node-accent-color': 'transparent',
        ...(data.nodeWidth && { width: `${data.nodeWidth}px` }),
      } as React.CSSProperties;
    }

    // Local objects: normal styling
    const isDashed = usesDashedBorder(data.object_type);
    return {
      borderRadius,
      // Neutral background - left bar provides schema color
      backgroundColor: 'var(--colorNeutralBackground1)',
      // Views get soft dashed border, others no border
      borderColor: isDashed ? 'var(--colorNeutralStroke2)' : 'transparent',
      borderWidth: isDashed ? '1px' : '0',
      borderStyle: isDashed ? 'dashed' : 'solid',
      // Pass schema color to CSS for left accent bar
      '--node-accent-color': schemaColor,
      // Apply calculated uniform width (falls back to CSS min/max if not provided)
      ...(data.nodeWidth && { width: `${data.nodeWidth}px` }),
    } as React.CSSProperties;
  }, [data.schemaColor, data.object_type, data.nodeWidth, isExternal]);

  // Layout-aware handle positions
  const isHorizontal = data.layoutDirection !== 'TB';
  const targetPosition = isHorizontal ? Position.Left : Position.Top;
  const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

  // Get the data model icon component (only for local objects)
  const DataModelIconComponent = !isExternal && data.dataModelIcon
    ? ICON_COMPONENTS_16[data.dataModelIcon]
    : null;

  const nodeContent = (
    <div className={stateClasses} style={nodeStyles}>
      {/* External indicator badge (top-right corner, gray) */}
      {isExternal && (
        <div className="data-lineage-node__external-badge" title="External reference">
          <Link16Regular />
        </div>
      )}
      <div className="data-lineage-node__name">
        {/* Data model type icon prefix - only for local objects */}
        {DataModelIconComponent && (
          <span className="data-lineage-node__model-icon" title={data.dataModelType}>
            <DataModelIconComponent />
          </span>
        )}
        {data.name}
      </div>
      <div className="data-lineage-node__footer">
        {/* External nodes show truncated path, local objects show schema */}
        <span className="data-lineage-node__schema">
          {isExternal ? truncatePath(data.refName || data.ref_name) : data.schema}
        </span>
        <span className="data-lineage-node__type">
          {getTypeAbbrev(data.object_type, data.externalRefType)}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <Handle
        type="target"
        position={targetPosition}
        style={{ background: data.schemaColor || 'var(--colorNeutralStroke1)' }}
      />

      <Tooltip
        content={<NodeTooltipContent data={data} />}
        relationship="description"
        positioning="above"
        withArrow
      >
        {nodeContent}
      </Tooltip>

      <Handle
        type="source"
        position={sourcePosition}
        style={{ background: data.schemaColor || 'var(--colorNeutralStroke1)' }}
      />
    </>
  );
}

export const LineageNode = memo(LineageNodeComponent);
