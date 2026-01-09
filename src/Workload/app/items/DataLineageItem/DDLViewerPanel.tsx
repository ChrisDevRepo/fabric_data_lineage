/**
 * DDLViewerPanel Component
 * Displays SQL DDL definitions using Monaco Editor
 * Uses Fabric design tokens and FluentUI v9 components
 *
 * Uses shared Monaco config from monacoConfig.ts for consistency
 * with DDLViewer component used in DataLineageSearchPage.
 *
 * DDL is loaded on-demand via useDdlLoader hook (not pre-loaded).
 */

import React, { useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Button,
  Spinner,
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Copy24Regular,
  DocumentSearch24Regular,
  Code24Regular,
  ArrowClockwise24Regular,
} from '@fluentui/react-icons';
import { MONACO_EDITOR_OPTIONS } from './monacoConfig';
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

  // Handle editor mount - store reference for search functionality
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure find widget to open with Ctrl+F
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
  }, []);

  // Copy DDL to clipboard
  const handleCopy = useCallback(async () => {
    if (ddlText) {
      try {
        await navigator.clipboard.writeText(ddlText);
        // Could add notification here via Fabric SDK
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
          // No node selected
          <div className="ddl-viewer-panel__empty">
            <Code24Regular style={{ fontSize: 48, color: tokens.colorNeutralForeground4 }} />
            <Text size={400} style={{ color: tokens.colorNeutralForeground2 }}>
              No object selected
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              Right-click a node and select "View DDL" to see its definition
            </Text>
          </div>
        ) : isLoading ? (
          // Loading state
          <div className="ddl-viewer-panel__empty">
            <Spinner size="large" label="Loading DDL..." />
          </div>
        ) : error ? (
          // Error state with retry
          <div className="ddl-viewer-panel__empty">
            <Code24Regular style={{ fontSize: 48, color: tokens.colorPaletteRedForeground1 }} />
            <Text size={400} style={{ color: tokens.colorPaletteRedForeground1 }}>
              Failed to load DDL
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center' }}>
              {error}
            </Text>
            <Button
              appearance="primary"
              icon={<ArrowClockwise24Regular />}
              onClick={retry}
              style={{ marginTop: tokens.spacingVerticalL }}
            >
              Retry
            </Button>
          </div>
        ) : !ddlText ? (
          // Node selected but no DDL available
          <div className="ddl-viewer-panel__empty">
            <Code24Regular style={{ fontSize: 48, color: tokens.colorNeutralForeground4 }} />
            <Text size={400} style={{ color: tokens.colorNeutralForeground2 }}>
              No DDL available
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              {node.objectType === 'Table'
                ? 'Tables do not have DDL definitions. Column metadata will be shown when available.'
                : 'This object does not have a SQL definition in the dataset.'}
            </Text>
          </div>
        ) : (
          // Monaco Editor with SQL highlighting
          <Editor
            height="100%"
            language="sql"
            theme="vs" // Light theme to match Fabric
            value={ddlText}
            onMount={handleEditorMount}
            options={MONACO_EDITOR_OPTIONS}
            loading={
              <div className="ddl-viewer-panel__loading">
                <Spinner size="medium" label="Loading editor..." />
              </div>
            }
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
