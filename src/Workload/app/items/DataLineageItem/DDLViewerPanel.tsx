/**
 * DDLViewerPanel Component
 * Displays SQL DDL definitions using Monaco Editor
 * Uses Fabric design tokens and FluentUI v9 components
 *
 * Uses shared Monaco config from monacoConfig.ts for consistency
 * with DDLViewer component used in DataLineageSearchPage.
 */

import React, { useCallback, useRef } from 'react';
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
} from '@fluentui/react-icons';
import { MONACO_EDITOR_OPTIONS } from './monacoConfig';

export interface DDLViewerNode {
  id: string;
  name: string;
  schema: string;
  objectType: string;
  ddlText: string | null;
}

export interface DDLViewerPanelProps {
  node: DDLViewerNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DDLViewerPanel({ node, isOpen, onClose }: DDLViewerPanelProps) {
  const editorRef = useRef<any>(null);

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
    if (node?.ddlText) {
      try {
        await navigator.clipboard.writeText(node.ddlText);
        // Could add notification here via Fabric SDK
      } catch (err) {
        console.error('Failed to copy DDL:', err);
      }
    }
  }, [node?.ddlText]);

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
          {node?.ddlText && (
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
        ) : !node.ddlText ? (
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
            value={node.ddlText}
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
      {node?.ddlText && (
        <div className="ddl-viewer-panel__footer">
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Press <kbd>Ctrl+F</kbd> to search
          </Text>
        </div>
      )}
    </div>
  );
}
