/**
 * DataLineageItem Default View
 *
 * Main visualization using ReactFlow with Dagre layout.
 * Toolbar has been moved to the Fabric Ribbon (per UX guidelines).
 * This component now receives filters from the editor.
 *
 * Node Interactions:
 * - Single click: Highlight node + neighbors, dim others (visual only)
 * - Double-click: Quick trace (1 up/1 down) - filters graph to direct neighbors
 * - Right-click: Context menu with extended trace options, View DDL
 * - Click background: Reset highlighting, close context menu
 *
 * Layout Configuration:
 * - Dagre: nodesep=80, ranksep=120 (spacing for edge visibility)
 * - Node width: 140-180px (90th percentile of name lengths, truncate with ellipsis)
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// Suppress ResizeObserver loop error - this is a known benign issue with ReactFlow
// See: https://github.com/xyflow/xyflow/issues/3076
if (typeof window !== 'undefined') {
  const resizeObserverErr = window.onerror;
  window.onerror = (message, ...args) => {
    if (typeof message === 'string' && message.includes('ResizeObserver loop')) {
      return true; // Suppress the error
    }
    return resizeObserverErr ? resizeObserverErr(message, ...args) : false;
  };
}

import {
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import { DataNode, ObjectType } from './types';
import { LineageNode } from './LineageNode';
import { useGraphology } from './useGraphology';
import { useLineageFilters } from './useLineageFilters';
import { useInteractiveTrace } from './useInteractiveTrace';
import { LineageLegend, getSchemaColor } from './LineageLegend';
import { LineageToolbar } from './LineageToolbar';
import { TraceControls, TraceActiveBanner } from './TraceControls';
import { NodeContextMenu } from './NodeContextMenu';
import { DDLViewerPanel, DDLViewerNode } from './DDLViewerPanel';
import { exportGraphToImage } from './exportUtils';
import {
  DataModelTypeRule,
  DataModelIcon,
  EdgeType,
  DEFAULT_DATA_MODEL_TYPES,
  classifyObject,
} from './DataLineageItemDefinition';
import { getThemeColors, ThemeModeOverride } from './useReactFlowTheme';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import './DataLineageItem.scss';

// Context menu state type
interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  schemaName: string;
  objectType: string;
  hasSql: boolean;
  ddlText: string | null;
}

// Custom node types
const nodeTypes = {
  lineageNode: LineageNode,
};

export interface DataLineageItemDefaultViewProps {
  /** Lineage data from GraphQL */
  data: DataNode[];
  /** Total count before exclude patterns (for display) */
  totalCount?: number;
  /** Number of objects hidden by exclude patterns */
  excludedCount?: number;
  /** Whether demo mode is active (using sample data) */
  isDemo?: boolean;
  onNodeClick?: (node: DataNode) => void;
  onControlsReady?: (controls: GraphControls) => void;
  /** Initial preferences from saved definition */
  initialPreferences?: {
    layoutDirection?: 'LR' | 'TB';
    themeMode?: ThemeModeOverride;
    showMinimap?: boolean;
    showControls?: boolean;
    edgeType?: EdgeType;
    hideIsolated?: boolean;
    focusSchema?: string | null;
    selectedSchemas?: string[];
    selectedObjectTypes?: ObjectType[];
    selectedDataModelTypes?: string[];
    defaultUpstreamLevels?: number;
    defaultDownstreamLevels?: number;
  };
  /** Data model type classification rules */
  dataModelTypes?: DataModelTypeRule[];
  /** Callback when filter state changes (for persistence) */
  onFilterChange?: (changes: {
    selectedSchemas?: string[];
    selectedObjectTypes?: ObjectType[];
    selectedDataModelTypes?: string[];
    focusSchema?: string | null;
    hideIsolated?: boolean;
  }) => void;
}

export interface GraphControls {
  fitView: () => void;
  focusNode: (nodeId: string) => void;
  exportToSvg: () => void;
}

// Layout cache for large datasets (> 300 nodes)
// Avoids expensive Dagre recalculation when only data properties change
const layoutCache = new Map<string, { positions: Map<string, { x: number; y: number }> }>();
const LAYOUT_CACHE_THRESHOLD = 300;
const LAYOUT_CACHE_MAX_SIZE = 10;

// Generate cache key from node IDs and layout direction
const getLayoutCacheKey = (nodeIds: string[], direction: 'LR' | 'TB'): string => {
  return `${direction}:${nodeIds.sort().join(',')}`;
};

// Dagre layout function with caching for large datasets
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: Node[]; edges: Edge[] } => {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  const nodeWidth = 160;
  const nodeHeight = 60;

  // Check cache for large datasets
  const nodeIds = nodes.map((n) => n.id);
  const cacheKey = getLayoutCacheKey(nodeIds, direction);

  if (nodes.length > LAYOUT_CACHE_THRESHOLD && layoutCache.has(cacheKey)) {
    const cached = layoutCache.get(cacheKey)!;
    // Apply cached positions to nodes
    const layoutedNodes = nodes.map((node) => {
      const pos = cached.positions.get(node.id);
      return {
        ...node,
        position: pos || { x: 0, y: 0 },
      };
    });
    return { nodes: layoutedNodes, edges };
  }

  // Calculate layout using Dagre
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 180,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Build positions map and layouted nodes
  const positions = new Map<string, { x: number; y: number }>();
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const pos = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    positions.set(node.id, pos);
    return {
      ...node,
      position: pos,
    };
  });

  // Cache result for large datasets
  if (nodes.length > LAYOUT_CACHE_THRESHOLD) {
    layoutCache.set(cacheKey, { positions });
    // Evict oldest entries if cache too large
    if (layoutCache.size > LAYOUT_CACHE_MAX_SIZE) {
      const firstKey = layoutCache.keys().next().value;
      if (firstKey) {
        layoutCache.delete(firstKey);
      }
    }
  }

  return { nodes: layoutedNodes, edges };
};

// Node width calculation constants
const MIN_NODE_WIDTH = 140; // Minimum width in pixels
const MAX_NODE_WIDTH = 180; // Maximum width in pixels (truncate beyond this)
const CHAR_WIDTH = 8;       // Approximate width per character at fontSizeBase300
const NODE_PADDING = 40;    // Horizontal padding (borders + internal spacing)

/**
 * Calculate uniform node width based on 90th percentile of name lengths.
 * Using percentile instead of max avoids outliers (one very long name) from
 * stretching all nodes. The top 10% longest names get truncated with ellipsis.
 * This is calculated ONCE on initial load, not recalculated on filter changes.
 */
function calculateNodeWidth(nodes: DataNode[]): number {
  if (nodes.length === 0) return MIN_NODE_WIDTH;

  // Get all name lengths and sort
  const nameLengths = nodes.map(n => n.name.length).sort((a, b) => a - b);

  // Calculate 90th percentile index (90% of names will fit without truncation)
  const percentileIndex = Math.floor(nameLengths.length * 0.9);
  const targetLength = nameLengths[Math.min(percentileIndex, nameLengths.length - 1)];

  // Calculate required width: chars * char_width + padding
  const requiredWidth = targetLength * CHAR_WIDTH + NODE_PADDING;

  // Clamp between min and max
  return Math.min(Math.max(requiredWidth, MIN_NODE_WIDTH), MAX_NODE_WIDTH);
}

// Options for trace highlighting and edge selection
interface ConvertOptions {
  selectedNodeId?: string;
  tracedNodeIds?: Set<string>;
  tracedEdgeIds?: Set<string>;
  traceStartNodeId?: string;
  isTraceModeActive?: boolean;
  layoutDirection?: 'LR' | 'TB';
  // Edge click highlighting
  edgeHighlightNodeIds?: Set<string>;
  edgeHighlightEdgeIds?: Set<string>;
  isEdgeHighlightActive?: boolean;
  // Uniform node width
  nodeWidth?: number;
  // Data model type classification
  dataModelTypes?: DataModelTypeRule[];
  // Edge type (from preferences)
  edgeType?: EdgeType;
  // Theme mode override
  themeMode?: ThemeModeOverride;
}

// Convert DataNodes to ReactFlow nodes and edges
const convertToFlowElements = (
  dataNodes: DataNode[],
  allSchemas: string[],
  options: ConvertOptions = {}
): { nodes: Node[]; edges: Edge[] } => {
  const {
    selectedNodeId,
    tracedNodeIds,
    tracedEdgeIds,
    traceStartNodeId,
    isTraceModeActive,
    layoutDirection,
    edgeHighlightNodeIds,
    edgeHighlightEdgeIds,
    isEdgeHighlightActive,
    nodeWidth,
    dataModelTypes = DEFAULT_DATA_MODEL_TYPES,
    edgeType = 'bezier',
    themeMode = 'auto',
  } = options;

  // Get theme-aware colors for edges (respects themeMode override)
  const themeColors = getThemeColors(themeMode);

  const nodeMap = new Map(dataNodes.map((n) => [n.id, n]));
  const hasTraceResults = isTraceModeActive && tracedNodeIds && tracedNodeIds.size > 0;
  const hasEdgeHighlight = isEdgeHighlightActive && edgeHighlightNodeIds && edgeHighlightNodeIds.size > 0;

  // Build bidirectional map for O(1) lookup (from SQL-computed bidirectional_with)
  const bidirectionalMap = new Map<string, Set<string>>();
  dataNodes.forEach((node) => {
    if (node.bidirectional_with && node.bidirectional_with.length > 0) {
      bidirectionalMap.set(node.id, new Set(node.bidirectional_with));
    }
  });

  const nodes: Node[] = dataNodes.map((dataNode) => {
    const isTraced = tracedNodeIds?.has(dataNode.id) ?? false;
    const isTraceStart = dataNode.id === traceStartNodeId;
    const isEdgeHighlighted = edgeHighlightNodeIds?.has(dataNode.id) ?? false;
    // Dim if trace is active and not traced, OR if edge highlight is active and not highlighted
    const isDimmed = (hasTraceResults && !isTraced) || (hasEdgeHighlight && !isEdgeHighlighted);

    // Classify the object based on data model type rules (only for local objects)
    const classifiedType = dataNode.is_external
      ? { name: undefined as string | undefined, icon: undefined as DataModelIcon | undefined }
      : classifyObject(dataNode.name, dataModelTypes);

    return {
      id: dataNode.id,
      type: 'lineageNode',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        ...dataNode,
        isSelected: dataNode.id === selectedNodeId,
        schemaColor: getSchemaColor(dataNode.schema, allSchemas),
        layoutDirection,
        isTraced,
        isTraceStart,
        isDimmed,
        nodeWidth,
        // Data model classification (local objects only)
        dataModelType: classifiedType.name,
        dataModelIcon: classifiedType.icon,
        // External object properties (passed through from dataNode)
        isExternal: dataNode.is_external ?? false,
        externalRefType: dataNode.external_ref_type,
        refName: dataNode.ref_name,
      },
    };
  });

  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  // Track bidirectional pairs to avoid duplicate edges
  const processedBidirectional = new Set<string>();

  dataNodes.forEach((dataNode) => {
    dataNode.outputs.forEach((targetId) => {
      // Skip edges where source equals target (not a valid lineage edge)
      if (targetId === dataNode.id) {
        return;
      }

      if (nodeMap.has(targetId)) {
        const edgeId = `${dataNode.id}-${targetId}`;
        const reverseKey = `${targetId}-${dataNode.id}`;

        // Skip if we already processed this as part of a bidirectional pair
        if (processedBidirectional.has(reverseKey)) {
          return;
        }

        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          const isTraced = tracedEdgeIds?.has(edgeId) ?? false;
          const isEdgeHighlighted = edgeHighlightEdgeIds?.has(edgeId) ?? false;
          // Dim if trace is active and not traced, OR if edge highlight is active and not highlighted
          const isDimmed = (hasTraceResults && !isTraced) || (hasEdgeHighlight && !isEdgeHighlighted);

          // Check if this edge is bidirectional (O(1) lookup)
          const isBidirectional =
            bidirectionalMap.has(dataNode.id) &&
            bidirectionalMap.get(dataNode.id)!.has(targetId);

          // Theme-aware edge colors
          const edgeColor = isTraced
            ? themeColors.edgeTraced
            : isDimmed
              ? themeColors.edgeDimmed
              : themeColors.edgeDefault;

          // Map edge type to ReactFlow type ('bezier' is 'default' in ReactFlow)
          const reactFlowEdgeType = edgeType === 'bezier' ? 'default' : edgeType;

          const edge: Edge = {
            id: edgeId,
            source: dataNode.id,
            target: targetId,
            type: reactFlowEdgeType,
            animated: isTraced,
            className: isTraced ? 'traced' : isDimmed ? 'dimmed' : '',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
              width: 30,
              height: 30,
            },
            style: {
              stroke: edgeColor,
              strokeWidth: isTraced ? 1 : 0.25,
              opacity: isDimmed ? 0.3 : 1,
            },
            zIndex: isTraced ? 10 : isDimmed ? 0 : 1,
          };

          // Add bidirectional styling: open arrow at start + ⇄ label on the EDGE
          if (isBidirectional) {
            edge.markerStart = {
              type: MarkerType.Arrow, // Open arrow (not filled) for backward flow
              color: edgeColor,
              width: 22,
              height: 22,
            };
            edge.label = '⇄'; // Label appears on the edge line
            edge.labelStyle = {
              fill: edgeColor,
              fontWeight: 'bold',
              fontSize: '16px',
            };
            // No background - only show the symbol
            edge.labelShowBg = false;
            // Mark this pair as processed to skip the reverse edge
            processedBidirectional.add(edgeId);
          }

          edges.push(edge);
        }
      }
    });
  });

  return { nodes, edges };
};

// Inner component that uses ReactFlow hooks
function DataLineageGraphInner({
  data,
  totalCount,
  excludedCount = 0,
  isDemo = false,
  onNodeClick,
  onControlsReady,
  initialPreferences,
  dataModelTypes = DEFAULT_DATA_MODEL_TYPES,
  onFilterChange,
}: DataLineageItemDefaultViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [ddlViewerNode, setDdlViewerNode] = useState<DDLViewerNode | null>(null);
  const reactFlowInstance = useReactFlow();

  // Edge click highlight state
  const [edgeHighlightNodeIds, setEdgeHighlightNodeIds] = useState<Set<string>>(new Set());
  const [edgeHighlightEdgeIds, setEdgeHighlightEdgeIds] = useState<Set<string>>(new Set());
  const isEdgeHighlightActive = edgeHighlightNodeIds.size > 0;

  // Use provided data from GraphQL
  const allDataNodes = data;

  // Build graphology graph for efficient traversal (shared by filters and trace)
  const { lineageGraph } = useGraphology(allDataNodes);

  // Merge dataModelTypes into initialPreferences for useLineageFilters
  const filterOptions = useMemo(() => ({
    ...initialPreferences,
    dataModelTypes,
  }), [initialPreferences, dataModelTypes]);

  // Initialize filters with saved preferences, notify parent on changes
  const filters = useLineageFilters(allDataNodes, lineageGraph, filterOptions, onFilterChange);
  const { filteredNodes, layoutDirection, availableSchemas, filterConfig, showMinimap, showControls, edgeType } = filters;

  // Get theme mode preference (default to 'auto')
  const themeMode = (initialPreferences?.themeMode ?? 'auto') as ThemeModeOverride;

  // Initialize trace mode with graphology graph
  const trace = useInteractiveTrace(lineageGraph);
  const {
    isTraceModeActive,
    isTraceFilterApplied,
    tracedNodeIds,
    tracedEdgeIds,
    traceStartNode,
    startTrace,
    startTraceImmediate,
    applyTrace,
    exitTraceMode,
  } = trace;

  // Total nodes count for display (use provided total or data length)
  const totalNodes = totalCount ?? allDataNodes.length;

  // Calculate node width ONCE based on all data (not filtered)
  // This ensures consistent node sizes regardless of current filter state
  const nodeWidth = useMemo(() => calculateNodeWidth(allDataNodes), [allDataNodes]);

  // When trace filter is applied, only show traced nodes
  // This is the key difference from just highlighting - we actually FILTER the graph
  const displayNodes = useMemo(() => {
    if (isTraceFilterApplied && tracedNodeIds.size > 0) {
      // Filter to only traced nodes
      return filteredNodes.filter(node => tracedNodeIds.has(node.id));
    }
    return filteredNodes;
  }, [filteredNodes, isTraceFilterApplied, tracedNodeIds]);

  // Convert to ReactFlow format and apply layout
  // Use displayNodes which is filtered when trace is applied
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const { nodes, edges } = convertToFlowElements(
      displayNodes,
      availableSchemas,
      {
        selectedNodeId,
        tracedNodeIds,
        tracedEdgeIds,
        traceStartNodeId: traceStartNode?.id,
        isTraceModeActive: isTraceModeActive || isTraceFilterApplied,
        layoutDirection,
        edgeHighlightNodeIds,
        edgeHighlightEdgeIds,
        isEdgeHighlightActive,
        nodeWidth,
        dataModelTypes,
        edgeType,
        themeMode,
      }
    );
    const layouted = getLayoutedElements(nodes, edges, layoutDirection);
    return { layoutedNodes: layouted.nodes, layoutedEdges: layouted.edges };
  }, [displayNodes, availableSchemas, selectedNodeId, layoutDirection, tracedNodeIds, tracedEdgeIds, traceStartNode, isTraceModeActive, isTraceFilterApplied, edgeHighlightNodeIds, edgeHighlightEdgeIds, isEdgeHighlightActive, nodeWidth, dataModelTypes, edgeType, themeMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes/edges when layout changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Handle node click - highlight clicked node and its neighbors, dim others
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);

      // Find the clicked DataNode and notify parent
      const clickedNode = displayNodes.find((n) => n.id === node.id);
      if (!clickedNode) return;
      if (onNodeClick) onNodeClick(clickedNode);

      // Use graphology for neighbor lookup (more efficient than manual iteration)
      const displayNodeIds = new Set(displayNodes.map((n) => n.id));
      const highlightNodes = new Set<string>([node.id]);
      const highlightEdges = new Set<string>();

      if (lineageGraph.hasNode(node.id)) {
        // Add visible neighbors
        lineageGraph.forEachNeighbor(node.id, (neighborId) => {
          if (displayNodeIds.has(neighborId)) highlightNodes.add(neighborId);
        });
        // Add edges between highlighted nodes
        lineageGraph.forEachEdge(node.id, (_, _attr, source, target) => {
          if (highlightNodes.has(source) && highlightNodes.has(target)) {
            highlightEdges.add(`${source}-${target}`);
          }
        });
      }

      setEdgeHighlightNodeIds(highlightNodes);
      setEdgeHighlightEdgeIds(highlightEdges);
    },
    [displayNodes, onNodeClick, lineageGraph]
  );

  // Handle node double-click - start trace with direct neighbors (1 level up/down)
  // IMPORTANT: External nodes don't support tracing (no double-click action)
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Find the clicked DataNode
      const clickedNode = displayNodes.find((n) => n.id === node.id);
      if (!clickedNode) return;

      // External nodes don't support double-click trace
      if (clickedNode.is_external) return;

      // Clear any existing highlight
      setEdgeHighlightNodeIds(new Set());
      setEdgeHighlightEdgeIds(new Set());

      // Start trace and immediately apply with configured default levels
      startTraceImmediate(node.id, clickedNode.name, {
        upstreamLevels: initialPreferences?.defaultUpstreamLevels ?? 1,
        downstreamLevels: initialPreferences?.defaultDownstreamLevels ?? 1,
      });
    },
    [displayNodes, startTraceImmediate, initialPreferences?.defaultUpstreamLevels, initialPreferences?.defaultDownstreamLevels]
  );

  // Handle node right-click - show context menu
  // IMPORTANT: External nodes don't support context menu (no DDL, no trace origin)
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const dataNode = displayNodes.find((n) => n.id === node.id);
      if (!dataNode) return;

      // External nodes don't support context menu
      if (dataNode.is_external) return;

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeName: dataNode.name,
        schemaName: dataNode.schema,
        objectType: dataNode.object_type,
        hasSql: !!dataNode.ddl_text,
        ddlText: dataNode.ddl_text || null,
      });
    },
    [displayNodes]
  );

  // Handle show SQL - opens DDL viewer panel
  const handleShowSql = useCallback(() => {
    if (contextMenu) {
      setDdlViewerNode({
        id: contextMenu.nodeId,
        name: contextMenu.nodeName,
        schema: contextMenu.schemaName,
        objectType: contextMenu.objectType,
        ddlText: contextMenu.ddlText,
      });
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Close context menu and reset highlight when clicking on pane (background)
  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    setEdgeHighlightNodeIds(new Set());
    setEdgeHighlightEdgeIds(new Set());
  }, []);

  // Handle focus node (from search in ribbon)
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (node && reactFlowInstance) {
        // Center on node with zoom
        reactFlowInstance.setCenter(
          node.position.x + 80, // center of node (nodeWidth/2)
          node.position.y + 30, // center of node (nodeHeight/2)
          { zoom: 1.5, duration: 500 }
        );
      }
    },
    [nodes, reactFlowInstance]
  );

  // Handle fit view
  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.1, duration: 300 });
    }
  }, [reactFlowInstance]);

  // Center on hub node (most connected) - used by reset filters
  const handleCenterOnHub = useCallback(() => {
    if (!reactFlowInstance || layoutedNodes.length === 0) return;

    // Find hub node using graphology's degree()
    const hubNode = layoutedNodes.reduce((hub, node) => {
      const degree = lineageGraph.hasNode(node.id) ? lineageGraph.degree(node.id) : 0;
      const hubDegree = lineageGraph.hasNode(hub.id) ? lineageGraph.degree(hub.id) : 0;
      return degree > hubDegree ? node : hub;
    }, layoutedNodes[0]);

    // Center on hub node with slight delay to allow layout updates
    setTimeout(() => {
      reactFlowInstance.setCenter(
        hubNode.position.x + 80,
        hubNode.position.y + 30,
        { zoom: 0.75, duration: 300 }
      );
    }, 100);
  }, [reactFlowInstance, layoutedNodes, lineageGraph]);

  // Handle export to image (captures exactly what's on screen)
  const handleExportToSvg = useCallback(() => {
    if (nodes.length === 0) {
      console.warn('No nodes to export');
      return;
    }

    exportGraphToImage({
      reactFlowInstance,
      format: 'png', // PNG is more reliable than SVG with html-to-image
      title: 'Data Lineage',
    });
  }, [nodes.length, reactFlowInstance]);

  // Memoized minimap node color function to prevent re-renders
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as DataNode & { schemaColor?: string };
    if (data?.schemaColor) {
      return data.schemaColor;
    }
    switch (data?.object_type) {
      case 'Table': return 'var(--colorPaletteBlueBorder1)';
      case 'View': return 'var(--colorPaletteGreenBorder1)';
      case 'Stored Procedure': return 'var(--colorPaletteMarigoldBorder1)';
      case 'Function': return 'var(--colorPalettePurpleBorder1)';
      default: return 'var(--colorNeutralStroke1)';
    }
  }, []);

  // Use ref to track if we've already sent controls to avoid infinite loops
  const controlsReadyRef = useRef(false);
  const onControlsReadyRef = useRef(onControlsReady);
  onControlsReadyRef.current = onControlsReady;

  // Stable controls object using refs
  const controlsRef = useRef<GraphControls>({
    fitView: () => {},
    focusNode: () => {},
    exportToSvg: () => {},
  });

  // Update control refs when handlers change
  controlsRef.current.fitView = handleFitView;
  controlsRef.current.focusNode = handleFocusNode;
  controlsRef.current.exportToSvg = handleExportToSvg;

  // Expose controls to parent component - only once
  useEffect(() => {
    if (!controlsReadyRef.current && onControlsReadyRef.current && reactFlowInstance) {
      controlsReadyRef.current = true;
      onControlsReadyRef.current(controlsRef.current);
    }
  }, [reactFlowInstance]); // Only depend on reactFlowInstance being ready

  // Set initial view: zoom to readable level, centered on hub node
  // Focus on most-connected node (hub) instead of geometric center
  // This ensures we land on a real node, not empty space
  const initialViewSet = useRef(false);
  useEffect(() => {
    if (!reactFlowInstance || layoutedNodes.length === 0 || initialViewSet.current) {
      return undefined;
    }

    // Small delay to ensure layout is complete
    const timer = setTimeout(() => {
      initialViewSet.current = true;

      // Find hub node using graphology's degree() - most connected node
      const hubNode = layoutedNodes.reduce((hub, node) => {
        const degree = lineageGraph.hasNode(node.id) ? lineageGraph.degree(node.id) : 0;
        const hubDegree = lineageGraph.hasNode(hub.id) ? lineageGraph.degree(hub.id) : 0;
        return degree > hubDegree ? node : hub;
      }, layoutedNodes[0]);

      // Center on hub node
      reactFlowInstance.setCenter(
        hubNode.position.x + 80,  // +nodeWidth/2
        hubNode.position.y + 30,  // +nodeHeight/2
        { zoom: 0.75, duration: 300 }
      );
    }, 150);

    return () => clearTimeout(timer);
  }, [reactFlowInstance, layoutedNodes]);

  // Auto-fit view when trace filter is applied or reset
  // This ensures the filtered graph is properly centered and visible
  const prevTraceFilterApplied = useRef(isTraceFilterApplied);
  useEffect(() => {
    if (!reactFlowInstance) return undefined;

    // Only trigger on change of isTraceFilterApplied
    if (prevTraceFilterApplied.current !== isTraceFilterApplied) {
      prevTraceFilterApplied.current = isTraceFilterApplied;

      // Delay to allow layout to recalculate
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
      }, 200);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [reactFlowInstance, isTraceFilterApplied]);

  return (
    <div className="data-lineage-view">
      {/* Demo Mode Banner - shown when using sample data */}
      {isDemo && (
        <MessageBar intent="info" className="demo-mode-banner">
          <MessageBarBody>
            <MessageBarTitle>Demo Mode</MessageBarTitle>
            <Text size={200}>
              Using sample data ({totalNodes} objects across 8 schemas) — no database connection required.
              Configure a GraphQL endpoint in Settings to connect to live data.
            </Text>
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Filter Toolbar - stays inside view to avoid re-render issues */}
      <LineageToolbar
        filters={filters}
        totalNodes={totalNodes}
        onFocusNode={handleFocusNode}
        onCenterOnHub={handleCenterOnHub}
        trace={trace}
        excludedCount={excludedCount}
        dataModelTypes={dataModelTypes}
      />

      {/* Trace Controls - shown when trace mode is active but filter not yet applied */}
      {isTraceModeActive && traceStartNode && !isTraceFilterApplied && (
        <TraceControls
          startNodeName={traceStartNode.name}
          onApply={applyTrace}
          onClose={exitTraceMode}
          initialUpstream={initialPreferences?.defaultUpstreamLevels ?? 1}
          initialDownstream={initialPreferences?.defaultDownstreamLevels ?? 1}
        />
      )}

      {/* Trace Active Banner - shown when trace filter IS applied (nodes are filtered) */}
      {isTraceFilterApplied && traceStartNode && (
        <TraceActiveBanner
          startNodeName={traceStartNode.name}
          tracedCount={displayNodes.length}
          totalCount={filteredNodes.length}
          onExit={exitTraceMode}
        />
      )}

      {/* Graph container */}
      <div className="data-lineage-view__graph-container data-lineage-view__graph-container--full">
        <ErrorBoundary fallbackMessage="Graph visualization failed to load. Please refresh.">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={handlePaneClick}
          zoomOnDoubleClick={false}
          nodeTypes={nodeTypes}
          attributionPosition="bottom-left"
          minZoom={0.2}
          maxZoom={2.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
          panOnScroll
          zoomOnScroll={false}
          preventScrolling
          onlyRenderVisibleElements
        >
          {showControls && <Controls />}
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              maskStrokeColor="#0078d4"
              maskStrokeWidth={2}
            />
          )}

          {/* Legend overlay */}
          <LineageLegend
            schemas={availableSchemas}
            selectedSchemas={filterConfig.selectedSchemas}
          />
        </ReactFlow>
        </ErrorBoundary>

        {/* Context Menu - rendered outside ReactFlow for proper positioning */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            nodeName={contextMenu.nodeName}
            schemaName={contextMenu.schemaName}
            hasSql={contextMenu.hasSql}
            isTraceModeActive={isTraceModeActive || isTraceFilterApplied}
            onStartTrace={() => {
              startTrace(contextMenu.nodeId, `${contextMenu.schemaName}.${contextMenu.nodeName}`);
              setContextMenu(null);
            }}
            onShowSql={handleShowSql}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* DDL Viewer Panel - slides in from the right */}
        <DDLViewerPanel
          node={ddlViewerNode}
          isOpen={ddlViewerNode !== null}
          onClose={() => setDdlViewerNode(null)}
        />
      </div>
    </div>
  );
}

// Outer component that provides ReactFlowProvider
export function DataLineageItemDefaultView(props: DataLineageItemDefaultViewProps) {
  return (
    <ReactFlowProvider>
      <DataLineageGraphInner {...props} />
    </ReactFlowProvider>
  );
}
