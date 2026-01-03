/**
 * TraceControls Component
 * Inline controls for configuring trace mode (upstream/downstream levels)
 * Uses FluentUI v9 components for Fabric UX compliance
 */

import React, { useState, useCallback } from 'react';
import {
  Button,
  Input,
  Text,
  ToggleButton,
  Tooltip,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Play24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
} from '@fluentui/react-icons';
import { TraceConfig } from './types';

interface TraceControlsProps {
  startNodeName: string;
  onApply: (config: Omit<TraceConfig, 'startNodeId'>) => void;
  onClose: () => void;
  initialUpstream?: number;
  initialDownstream?: number;
}

export function TraceControls({
  startNodeName,
  onApply,
  onClose,
  initialUpstream = 3,
  initialDownstream = 3,
}: TraceControlsProps) {
  const [upstream, setUpstream] = useState(initialUpstream);
  const [downstream, setDownstream] = useState(initialDownstream);
  const [isUpstreamAll, setIsUpstreamAll] = useState(false);
  const [isDownstreamAll, setIsDownstreamAll] = useState(false);

  const handleApply = useCallback(() => {
    onApply({
      upstreamLevels: isUpstreamAll ? Number.MAX_SAFE_INTEGER : upstream,
      downstreamLevels: isDownstreamAll ? Number.MAX_SAFE_INTEGER : downstream,
    });
  }, [onApply, upstream, downstream, isUpstreamAll, isDownstreamAll]);

  const handleUpstreamChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 99) {
      setUpstream(value);
      setIsUpstreamAll(false);
    }
  }, []);

  const handleDownstreamChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 99) {
      setDownstream(value);
      setIsDownstreamAll(false);
    }
  }, []);

  return (
    <MessageBar
      intent="info"
      className="trace-controls"
    >
      <MessageBarBody className="trace-controls__body">
        <div className="trace-controls__content">
          {/* Start Node */}
          <div className="trace-controls__field">
            <Text size={200} weight="medium">From:</Text>
            <Text size={200} weight="semibold" className="trace-controls__node-name">
              {startNodeName}
            </Text>
          </div>

          {/* Upstream Levels */}
          <div className="trace-controls__field">
            <Tooltip content="Number of upstream levels to trace" relationship="label">
              <div className="trace-controls__level-control">
                <ArrowUp24Regular className="trace-controls__icon" />
                <Input
                  type="number"
                  value={String(upstream)}
                  min={0}
                  max={99}
                  onChange={handleUpstreamChange}
                  disabled={isUpstreamAll}
                  className="trace-controls__spin"
                  size="small"
                  style={{ width: '60px' }}
                />
                <ToggleButton
                  checked={isUpstreamAll}
                  onClick={() => setIsUpstreamAll(!isUpstreamAll)}
                  size="small"
                  appearance={isUpstreamAll ? 'primary' : 'subtle'}
                >
                  All
                </ToggleButton>
              </div>
            </Tooltip>
          </div>

          {/* Downstream Levels */}
          <div className="trace-controls__field">
            <Tooltip content="Number of downstream levels to trace" relationship="label">
              <div className="trace-controls__level-control">
                <ArrowDown24Regular className="trace-controls__icon" />
                <Input
                  type="number"
                  value={String(downstream)}
                  min={0}
                  max={99}
                  onChange={handleDownstreamChange}
                  disabled={isDownstreamAll}
                  className="trace-controls__spin"
                  size="small"
                  style={{ width: '60px' }}
                />
                <ToggleButton
                  checked={isDownstreamAll}
                  onClick={() => setIsDownstreamAll(!isDownstreamAll)}
                  size="small"
                  appearance={isDownstreamAll ? 'primary' : 'subtle'}
                >
                  All
                </ToggleButton>
              </div>
            </Tooltip>
          </div>
        </div>
      </MessageBarBody>

      <MessageBarActions>
        <Button
          appearance="primary"
          icon={<Play24Regular />}
          onClick={handleApply}
          size="small"
        >
          Apply
        </Button>
        <Button
          appearance="transparent"
          icon={<Dismiss24Regular />}
          onClick={onClose}
          aria-label="Close trace mode"
        />
      </MessageBarActions>
    </MessageBar>
  );
}

/**
 * Trace Active Banner - shown when trace results are displayed
 */
interface TraceActiveBannerProps {
  startNodeName: string;
  tracedCount: number;
  totalCount: number;
  onExit: () => void;
}

export function TraceActiveBanner({
  startNodeName,
  tracedCount,
  totalCount,
  onExit,
}: TraceActiveBannerProps) {
  return (
    <MessageBar
      intent="success"
      className="trace-active-banner"
    >
      <MessageBarBody>
        <MessageBarTitle>Trace Active</MessageBarTitle>
        <Text size={200}>
          Showing <strong>{tracedCount}</strong> of {totalCount} objects from{' '}
          <strong>{startNodeName}</strong>
        </Text>
      </MessageBarBody>
      <MessageBarActions containerAction={
        <Button
          appearance="transparent"
          icon={<Dismiss24Regular />}
          onClick={onExit}
          aria-label="Exit trace mode"
        />
      } />
    </MessageBar>
  );
}
