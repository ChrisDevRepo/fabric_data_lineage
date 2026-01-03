/**
 * DataLineageItem Expanded View
 *
 * Full-page view for the lineage graph with minimal chrome.
 * Accessed via page.open() from the editor's expand button.
 * This provides a "fullscreen-like" experience within Fabric's constraints.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Text, Spinner } from '@fluentui/react-components';
import {
  ArrowMinimize24Regular,
  ZoomFit24Regular,
} from '@fluentui/react-icons';

import { PageProps, ContextProps } from '../../App';
import { callPageOpen } from '../../controller/PageController';
import { getWorkloadItem } from '../../controller/ItemCRUDController';
import { DataLineageItemDefaultView, GraphControls } from './DataLineageItemDefaultView';
import { DataLineageItemDefinition, DEFAULT_DEFINITION } from './DataLineageItemDefinition';
import { createLineageService, DEFAULT_GRAPHQL_ENDPOINT } from './LineageService';
import { DataNode } from './types';

import './DataLineageItem.scss';

interface ExpandedViewProps extends PageProps {}

export function DataLineageItemExpandedView({ workloadClient }: ExpandedViewProps) {
  const { t } = useTranslation();
  const { itemObjectId } = useParams<ContextProps>();

  // Graph controls
  const [graphControls, setGraphControls] = useState<GraphControls | undefined>();
  const [definition, setDefinition] = useState<DataLineageItemDefinition>(DEFAULT_DEFINITION);
  const [rawData, setRawData] = useState<DataNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data: try sessionStorage first (passed from editor), fallback to GraphQL
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      const itemId = itemObjectId || 'demo';
      const storageKey = `lineage-expand-${itemId}`;

      // Try to load from sessionStorage (passed from editor)
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const expandState = JSON.parse(stored);
          // Use if fresh (within last 30 seconds)
          if (expandState.timestamp && Date.now() - expandState.timestamp < 30000) {
            setRawData(expandState.data || []);
            setDefinition({ ...DEFAULT_DEFINITION, ...expandState.definition });
            sessionStorage.removeItem(storageKey); // Clean up
            setIsLoading(false);
            return; // Done - no need to load from GraphQL
          }
        }
      } catch (err) {
        console.warn('Failed to load from sessionStorage:', err);
      }

      // Fallback: Load from GraphQL
      try {
        // Load definition to get endpoint and exclude patterns
        let loadedDefinition = DEFAULT_DEFINITION;
        if (itemObjectId && itemObjectId !== 'demo') {
          try {
            const item = await getWorkloadItem<DataLineageItemDefinition>(
              workloadClient,
              itemObjectId,
              DEFAULT_DEFINITION
            );
            if (item.definition) {
              loadedDefinition = { ...DEFAULT_DEFINITION, ...item.definition };
              setDefinition(loadedDefinition);
            }
          } catch (err) {
            console.warn('Failed to load item definition, using defaults:', err);
          }
        }

        // Load data from GraphQL
        const graphqlEndpoint = loadedDefinition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;
        const service = createLineageService(workloadClient, graphqlEndpoint);
        const data = await service.getLineageData();
        setRawData(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('Failed to load lineage data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [workloadClient, itemObjectId]);

  // Filter data using exclude patterns
  const filteredData = useMemo((): DataNode[] => {
    const excludePatterns = definition.dataModelConfig?.excludePatterns || [];
    if (excludePatterns.length === 0) {
      return rawData;
    }

    const regexPatterns = excludePatterns.map((pattern) => {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexStr = escaped.replace(/\\\*/g, '.*');
      return new RegExp(regexStr, 'i');
    });

    return rawData.filter((node) => {
      const fullName = `${node.schema}.${node.name}`;
      return !regexPatterns.some((regex) => regex.test(fullName) || regex.test(node.name));
    });
  }, [rawData, definition.dataModelConfig?.excludePatterns]);

  // Controls ready callback
  const handleControlsReady = useCallback((c: GraphControls) => {
    setGraphControls(c);
  }, []);

  // Close expanded view - go back to editor
  const handleClose = useCallback(async () => {
    const workloadName = process.env.WORKLOAD_NAME || 'Org.DataLineage';
    const path = itemObjectId
      ? `/DataLineageItem-editor/${itemObjectId}`
      : '/DataLineageItem-demo';

    await callPageOpen(workloadClient, workloadName, path);
  }, [workloadClient, itemObjectId]);

  // Fit view
  const handleFitView = useCallback(() => {
    if (graphControls) {
      graphControls.fitView();
    }
  }, [graphControls]);

  // Loading state
  if (isLoading) {
    return (
      <div className="data-lineage-expanded data-lineage-expanded--loading">
        <Spinner size="large" label={t('LoadingData')} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="data-lineage-expanded data-lineage-expanded--error">
        <Text>{t('ErrorLoadingData')}: {error}</Text>
        <Button appearance="primary" onClick={handleClose}>
          {t('BackToEditor')}
        </Button>
      </div>
    );
  }

  return (
    <div className="data-lineage-expanded">
      {/* Minimal toolbar - just exit and fit view, filters are in the DefaultView */}
      <div className="data-lineage-expanded__toolbar">
        <div className="data-lineage-expanded__toolbar-left">
          <Tooltip content={t('BackToEditor')} relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowMinimize24Regular />}
              onClick={handleClose}
            >
              {t('Exit')}
            </Button>
          </Tooltip>
        </div>

        <div className="data-lineage-expanded__toolbar-center">
          <Text weight="semibold" size={400}>
            {t('DataLineage')} - {t('ExpandedView')}
          </Text>
        </div>

        <div className="data-lineage-expanded__toolbar-right">
          <Tooltip content={t('FitView')} relationship="label">
            <Button
              appearance="subtle"
              icon={<ZoomFit24Regular />}
              onClick={handleFitView}
            />
          </Tooltip>
        </div>
      </div>

      {/* Full-height graph - includes LineageToolbar for filters */}
      <div className="data-lineage-expanded__content">
        <DataLineageItemDefaultView
          data={filteredData}
          totalCount={rawData.length}
          onControlsReady={handleControlsReady}
          dataModelTypes={definition.dataModelConfig?.types}
          initialPreferences={{
            // Layout & theme
            layoutDirection: definition.preferences?.layoutDirection,
            themeMode: definition.preferences?.themeMode,
            // Canvas display
            showMinimap: definition.preferences?.showMinimap,
            showControls: definition.preferences?.showControls,
            edgeType: definition.preferences?.edgeType,
            // Behavior
            hideIsolated: definition.preferences?.hideIsolated,
            focusSchema: definition.preferences?.focusSchema,
            // Filter state
            selectedSchemas: definition.selectedSchemas,
            selectedObjectTypes: definition.selectedObjectTypes,
            // Trace defaults
            defaultUpstreamLevels: definition.preferences?.defaultUpstreamLevels,
            defaultDownstreamLevels: definition.preferences?.defaultDownstreamLevels,
          }}
        />
      </div>
    </div>
  );
}
