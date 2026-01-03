/**
 * Builds a Graphology directed graph from DataNode array for efficient traversal.
 */

import { useMemo } from 'react';
import Graph from 'graphology';
import { DataNode } from './types';

export interface UseGraphologyResult {
  /** Directed graph with all nodes and edges */
  lineageGraph: Graph;
  /** Unique schemas found in data */
  schemas: string[];
  /** Unique object types found in data */
  objectTypes: string[];
  /** Unique data model types found in data */
  dataModelTypes: string[];
}

export function useGraphology(allNodes: DataNode[]): UseGraphologyResult {
  const lineageGraph = useMemo(() => {
    const graph = new Graph({ type: 'directed' });
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    // Add all nodes with their attributes
    allNodes.forEach(node => {
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, { ...node });
      }
    });

    // Add edges from inputs/outputs
    // inputs: nodes that feed INTO this node (predecessors)
    // outputs: nodes that this node feeds INTO (successors)
    allNodes.forEach(node => {
      // Add edges from inputs (input -> this node)
      (node.inputs || []).forEach(inputId => {
        if (nodeMap.has(inputId)) {
          graph.mergeEdge(inputId, node.id);
        }
      });

      // Add edges to outputs (this node -> output)
      (node.outputs || []).forEach(outputId => {
        if (nodeMap.has(outputId)) {
          graph.mergeEdge(node.id, outputId);
        }
      });
    });

    return graph;
  }, [allNodes]);

  // Derive unique values for filters
  const { schemas, objectTypes, dataModelTypes } = useMemo(() => {
    const uniqueSchemas = [...new Set(allNodes.map(n => n.schema))].sort();
    const uniqueObjectTypes = [...new Set(allNodes.map(n => n.object_type))].sort();
    const uniqueDataModelTypes = [
      ...new Set(allNodes.map(n => n.data_model_type).filter(Boolean) as string[])
    ].sort();

    return {
      schemas: uniqueSchemas,
      objectTypes: uniqueObjectTypes,
      dataModelTypes: uniqueDataModelTypes,
    };
  }, [allNodes]);

  return { lineageGraph, schemas, objectTypes, dataModelTypes };
}
