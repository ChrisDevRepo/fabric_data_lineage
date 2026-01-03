/**
 * useInteractiveTrace Hook
 * Manages trace mode for upstream/downstream lineage exploration
 *
 * Features:
 * - startTrace: Open trace mode with TraceControls panel (right-click menu)
 * - startTraceImmediate: Quick trace with preset config (double-click shortcut)
 * - BFS traversal using graphology-traversal for efficient graph operations
 */

import { useState, useCallback, useMemo } from 'react';
import Graph from 'graphology';
import { bfsFromNode } from 'graphology-traversal';
import { TraceConfig } from './types';

export interface UseInteractiveTraceResult {
  // Trace state
  isTraceModeActive: boolean;
  isTraceFilterApplied: boolean; // True when trace results should filter the graph
  traceConfig: TraceConfig | null;
  tracedNodeIds: Set<string>;
  tracedEdgeIds: Set<string>;

  // Actions
  startTrace: (nodeId: string, nodeName: string) => void;
  startTraceImmediate: (nodeId: string, nodeName: string, config: Omit<TraceConfig, 'startNodeId'>) => void;
  applyTrace: (config: Omit<TraceConfig, 'startNodeId'>) => void;
  resetTrace: () => void;
  exitTraceMode: () => void;

  // For UI display
  traceStartNode: { id: string; name: string } | null;
}

/**
 * Find all paths between two nodes (for path mode)
 * Uses BFS in both directions to find all connecting paths
 */
function findAllPathsBetweenNodes(
  startNodeId: string,
  endNodeId: string,
  lineageGraph: Graph
): Set<string> {
  const nodesInPath = new Set<string>();

  // Try finding paths in downstream direction (start -> end)
  const downstreamPaths = findDirectionalPaths(startNodeId, endNodeId, lineageGraph, 'downstream');
  downstreamPaths.forEach(path => path.forEach(id => nodesInPath.add(id)));

  // Try finding paths in upstream direction (end -> start)
  const upstreamPaths = findDirectionalPaths(endNodeId, startNodeId, lineageGraph, 'upstream');
  upstreamPaths.forEach(path => path.forEach(id => nodesInPath.add(id)));

  return nodesInPath;
}

/**
 * Find paths in a single direction using BFS
 */
function findDirectionalPaths(
  fromNodeId: string,
  toNodeId: string,
  lineageGraph: Graph,
  direction: 'downstream' | 'upstream'
): string[][] {
  const allPaths: string[][] = [];
  const queue: { id: string; path: string[] }[] = [{ id: fromNodeId, path: [fromNodeId] }];
  const visited = new Map<string, number>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { id: currentId, path } = current;

    if (currentId === toNodeId) {
      allPaths.push(path);
      continue;
    }

    // Limit visits per node to handle cycles
    const visitCount = visited.get(currentId) || 0;
    if (visitCount > 3) continue;
    visited.set(currentId, visitCount + 1);

    // Get neighbors based on direction
    const getNeighbors = direction === 'downstream'
      ? (cb: (neighbor: string) => void) => lineageGraph.forEachOutNeighbor(currentId, cb)
      : (cb: (neighbor: string) => void) => lineageGraph.forEachInNeighbor(currentId, cb);

    getNeighbors((neighborId) => {
      if (path.includes(neighborId)) return; // Skip cycles in current path
      queue.push({ id: neighborId, path: [...path, neighborId] });
    });
  }

  return allPaths;
}

/**
 * Get edge IDs for traced nodes
 */
function getTracedEdgeIds(
  tracedNodeIds: Set<string>,
  lineageGraph: Graph
): Set<string> {
  const edgeIds = new Set<string>();

  tracedNodeIds.forEach(nodeId => {
    if (!lineageGraph.hasNode(nodeId)) return;

    lineageGraph.forEachOutNeighbor(nodeId, (targetId) => {
      if (tracedNodeIds.has(targetId)) {
        edgeIds.add(`${nodeId}-${targetId}`);
      }
    });
  });

  return edgeIds;
}

export function useInteractiveTrace(lineageGraph: Graph): UseInteractiveTraceResult {
  const [isTraceModeActive, setIsTraceModeActive] = useState(false);
  const [isTraceFilterApplied, setIsTraceFilterApplied] = useState(false);
  const [traceConfig, setTraceConfig] = useState<TraceConfig | null>(null);
  const [traceStartNode, setTraceStartNode] = useState<{ id: string; name: string } | null>(null);

  // Calculate traced nodes based on config using graphology-traversal
  const tracedNodeIds = useMemo(() => {
    if (!traceConfig?.startNodeId || !lineageGraph.hasNode(traceConfig.startNodeId)) {
      return new Set<string>();
    }

    const { startNodeId, endNodeId, upstreamLevels, downstreamLevels } = traceConfig;

    // Path mode: find all paths between start and end
    if (endNodeId && lineageGraph.hasNode(endNodeId)) {
      return findAllPathsBetweenNodes(startNodeId, endNodeId, lineageGraph);
    }

    // Level mode: traverse N levels upstream and downstream using graphology-traversal
    const visibleIds = new Set<string>();

    // Traverse upstream (inbound edges)
    if (upstreamLevels > 0) {
      bfsFromNode(lineageGraph, startNodeId, (nodeId, _attr, depth) => {
        visibleIds.add(nodeId);
        // Stop exploring neighbors if we've reached max depth
        if (depth >= upstreamLevels) return true;
        return false;
      }, { mode: 'inbound' });
    } else {
      visibleIds.add(startNodeId);
    }

    // Traverse downstream (outbound edges)
    if (downstreamLevels > 0) {
      bfsFromNode(lineageGraph, startNodeId, (nodeId, _attr, depth) => {
        visibleIds.add(nodeId);
        if (depth >= downstreamLevels) return true;
        return false;
      }, { mode: 'outbound' });
    }

    return visibleIds;
  }, [traceConfig, lineageGraph]);

  // Calculate traced edge IDs
  const tracedEdgeIds = useMemo(
    () => getTracedEdgeIds(tracedNodeIds, lineageGraph),
    [tracedNodeIds, lineageGraph]
  );

  // Start trace mode from a node - shows config panel first
  const startTrace = useCallback((nodeId: string, nodeName: string) => {
    setIsTraceModeActive(true);
    setTraceStartNode({ id: nodeId, name: nodeName });
    setTraceConfig(null);
  }, []);

  // Start trace and immediately apply config (for double-click quick trace)
  const startTraceImmediate = useCallback((
    nodeId: string,
    nodeName: string,
    config: Omit<TraceConfig, 'startNodeId'>
  ) => {
    setIsTraceModeActive(true);
    setTraceStartNode({ id: nodeId, name: nodeName });
    setTraceConfig({
      ...config,
      startNodeId: nodeId,
    });
    setIsTraceFilterApplied(true);
  }, []);

  // Apply trace with new configuration
  const applyTrace = useCallback((config: Omit<TraceConfig, 'startNodeId'>) => {
    if (!traceStartNode) return;

    setTraceConfig({
      ...config,
      startNodeId: traceStartNode.id,
    });
    setIsTraceFilterApplied(true);
  }, [traceStartNode]);

  // Reset trace (clear filter and allow new trace selection)
  const resetTrace = useCallback(() => {
    setTraceConfig(null);
    setTraceStartNode(null);
    setIsTraceFilterApplied(false);
  }, []);

  // Exit trace mode completely
  const exitTraceMode = useCallback(() => {
    setIsTraceModeActive(false);
    setTraceConfig(null);
    setTraceStartNode(null);
    setIsTraceFilterApplied(false);
  }, []);

  return {
    isTraceModeActive,
    isTraceFilterApplied,
    traceConfig,
    tracedNodeIds,
    tracedEdgeIds,
    startTrace,
    startTraceImmediate,
    applyTrace,
    resetTrace,
    exitTraceMode,
    traceStartNode,
  };
}
