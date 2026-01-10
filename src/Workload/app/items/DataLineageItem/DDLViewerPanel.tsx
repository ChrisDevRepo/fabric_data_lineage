/**
 * DDLViewerPanel Component
 * Side panel for viewing SQL DDL definitions.
 * Uses shared DDLViewer component for Monaco Editor display.
 *
 * DDL is loaded on-demand via useDdlLoader hook (not pre-loaded).
 */

import React, { useCallback, useRef, useEffect } from 'react';
import {
  Button,
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Copy24Regular,
  DocumentSearch24Regular,
  Code24Regular,
} from '@fluentui/react-icons';
import { DDLViewer } from './DDLViewer';
import { useDdlLoader } from './useDdlLoader';
import { LineageService } from './LineageService';

export interface DDLViewerNode {
  id: string;
  objectId: number; // Numeric ID for GraphQL query
  name: string;
  schema: string;
  objectType: string;
}

export interface DDLViewerPanelProps {
  node: DDLViewerNode | null;
  isOpen: boolean;
  onClose: () => void;
  service: LineageService | null;
  sourceId?: number;
}

export function DDLViewerPanel({ node, isOpen, onClose, service, sourceId }: DDLViewerPanelProps) {
  const editorRef = useRef<any>(null);
  const { ddlText, isLoading, error, loadDdl, retry, clear } = useDdlLoader(service);

  // Load DDL when node changes
  useEffect(() => {
    if (isOpen && node && service) {
      loadDdl(node.objectId, sourceId);
    }
    // Clear state when panel closes
    if (!isOpen) {
      clear();
    }
  }, [isOpen, node?.objectId, sourceId, service, loadDdl, clear]);

  // Store editor reference when DDLViewer mounts Monaco
  const handleEditorReady = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Copy DDL to clipboard
  const handleCopy = useCallback(async () => {
    if (ddlText) {
      try {
        await navigator.clipboard.writeText(ddlText);
      } catch (err) {
        console.error('Failed to copy DDL:', err);
      }
    }
  }, [ddlText]);

  // Open search in editor
  const handleSearch = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('actions.find')?.run();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="ddl-viewer-panel">
      {/* Header */}
      <div className="ddl-viewer-panel__header">
        <div className="ddl-viewer-panel__title">
          <Code24Regular className="ddl-viewer-panel__icon" />
          <div className="ddl-viewer-panel__title-text">
            <Text weight="semibold" size={400}>
              {node ? `${node.schema}.${node.name}` : 'DDL Viewer'}
            </Text>
            {node && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {node.objectType}
              </Text>
            )}
          </div>
        </div>
        <div className="ddl-viewer-panel__actions">
          {ddlText && (
            <>
              <Tooltip content="Search (Ctrl+F)" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<DocumentSearch24Regular />}
                  onClick={handleSearch}
                  aria-label="Search"
                />
              </Tooltip>
              <Tooltip content="Copy to clipboard" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Copy24Regular />}
                  onClick={handleCopy}
                  aria-label="Copy DDL"
                />
              </Tooltip>
            </>
          )}
          <Tooltip content="Close" relationship="label">
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              onClick={onClose}
              aria-label="Close panel"
            />
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="ddl-viewer-panel__content">
        {!node ? (
          // No node selected - panel-specific message
          <div className="ddl-viewer-panel__empty">
            <Code24Regular style={{ fontSize: 48, color: tokens.colorNeutralForeground4 }} />
            <Text size={400} style={{ color: tokens.colorNeutralForeground2 }}>
              No object selected
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              Right-click a node and select "View DDL" to see its definition
            </Text>
          </div>
        ) : (
          // Use shared DDLViewer for loading/error/empty/editor states
          <DDLViewer
            ddlText={ddlText}
            objectName={node.name}
            objectType={node.objectType}
            schemaName={node.schema}
            isLoading={isLoading}
            error={error}
            onRetry={retry}
            showHeader={false}
            onEditorReady={handleEditorReady}
          />
        )}
      </div>

      {/* Footer with keyboard hint */}
      {ddlText && (
        <div className="ddl-viewer-panel__footer">
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Press <kbd>Ctrl+F</kbd> to search
          </Text>
        </div>
      )}
    </div>
  );
}
