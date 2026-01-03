/**
 * DataLineageItem Empty View
 *
 * First-run experience when no data is loaded.
 * Follows MS Fabric UX Guidelines: minimal empty state with single action.
 *
 * Features:
 * - Progressive status messages during connection (cold-start UX)
 * - Retry progress indicator
 * - Only shows "Open Settings" after connection attempts exhausted
 *
 * Pattern: Empty state guides user to Settings panel (no duplicate forms)
 */

import React from 'react';
import { Button, Text, Spinner, ProgressBar, tokens } from '@fluentui/react-components';
import { Settings24Regular, DataTreemap24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';
import { ConnectionPhase } from './LineageService';
import './DataLineageItem.scss';

interface DataLineageItemEmptyViewProps {
  onOpenSettings: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  connectionPhase?: ConnectionPhase;
  connectionMessage?: string;
  connectionAttempt?: number;
  maxAttempts?: number;
  hasCache?: boolean;
  cacheAge?: string;
}

/**
 * Get progress value based on connection phase and attempt
 */
function getProgressValue(phase: ConnectionPhase, attempt: number, maxAttempts: number): number {
  if (phase === ConnectionPhase.Completed) return 1;
  if (phase === ConnectionPhase.Failed) return 0;
  if (phase === ConnectionPhase.Idle) return 0;

  // Base progress on attempt number
  const attemptProgress = (attempt / maxAttempts) * 0.8; // 80% for attempts

  // Add phase-specific progress
  const phaseProgress: Record<ConnectionPhase, number> = {
    [ConnectionPhase.Idle]: 0,
    [ConnectionPhase.Connecting]: 0.05,
    [ConnectionPhase.Authenticating]: 0.1,
    [ConnectionPhase.WaitingForService]: 0.15,
    [ConnectionPhase.LoadingData]: 0.18,
    [ConnectionPhase.Completed]: 0.2,
    [ConnectionPhase.Failed]: 0,
  };

  return Math.min(attemptProgress + phaseProgress[phase], 0.95);
}

/**
 * Slim empty view - guides user to Settings panel
 * Shows progressive loading status during connection
 */
export function DataLineageItemEmptyViewSimple({
  onOpenSettings,
  onRetry,
  isLoading = false,
  connectionPhase = ConnectionPhase.Idle,
  connectionMessage,
  connectionAttempt = 0,
  maxAttempts = 5,
  hasCache = false,
  cacheAge,
}: DataLineageItemEmptyViewProps) {
  const isFailed = connectionPhase === ConnectionPhase.Failed;
  const isConnecting = isLoading && !isFailed;

  return (
    <div className="data-lineage-empty">
      <DataTreemap24Regular className="data-lineage-empty__icon" />
      <Text className="data-lineage-empty__title">Data Lineage Visualization</Text>

      {isConnecting ? (
        // Progressive loading state
        <>
          <div style={{ width: '300px', marginTop: '16px', marginBottom: '8px' }}>
            <ProgressBar
              value={getProgressValue(connectionPhase, connectionAttempt, maxAttempts)}
              thickness="medium"
              color="brand"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="tiny" />
            <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
              {connectionMessage || 'Connecting...'}
            </Text>
          </div>
          {connectionAttempt > 1 && (
            <Text
              size={200}
              style={{
                marginTop: '8px',
                color: tokens.colorNeutralForeground3,
              }}
            >
              Attempt {connectionAttempt} of {maxAttempts}
            </Text>
          )}
          <Text
            size={200}
            style={{
              marginTop: '16px',
              color: tokens.colorNeutralForeground3,
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            Fabric services may take a moment to start up on first access.
          </Text>
        </>
      ) : isFailed ? (
        // Connection failed state
        <>
          <Text
            size={300}
            style={{
              marginTop: '16px',
              color: tokens.colorPaletteRedForeground1,
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            {connectionMessage || 'Unable to connect to the data source.'}
          </Text>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            {onRetry && (
              <Button
                appearance="primary"
                icon={<ArrowClockwise24Regular />}
                onClick={onRetry}
              >
                Retry Connection
              </Button>
            )}
            <Button
              appearance="secondary"
              icon={<Settings24Regular />}
              onClick={onOpenSettings}
            >
              Check Settings
            </Button>
          </div>

          {hasCache && cacheAge && (
            <Text
              size={200}
              style={{
                marginTop: '16px',
                color: tokens.colorNeutralForeground3,
              }}
            >
              Cached data available ({cacheAge} old) - try refreshing after service starts
            </Text>
          )}
        </>
      ) : (
        // Initial empty state
        <>
          <Text className="data-lineage-empty__description">
            Visualize data flow and dependencies across your Data Warehouse objects.
            Configure your data source to get started.
          </Text>

          <Button appearance="primary" icon={<Settings24Regular />} onClick={onOpenSettings}>
            Open Settings
          </Button>

          <Text
            size={200}
            style={{
              marginTop: '24px',
              color: tokens.colorNeutralForeground3,
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            In Settings, configure your GraphQL endpoint to connect to your Fabric SQL Database, or
            enable sample data for a demo.
          </Text>
        </>
      )}
    </div>
  );
}
