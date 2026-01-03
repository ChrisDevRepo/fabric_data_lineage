/**
 * DDLViewer Component
 *
 * Reusable Monaco Editor wrapper for displaying SQL DDL definitions.
 * Used by:
 * - DataLineageSearchPage (full-text search)
 * - DDLViewerPanel (side panel)
 *
 * Features:
 * - SQL syntax highlighting
 * - Read-only mode (no editing)
 * - Built-in Ctrl+F find
 * - Loading and empty states
 */

import React, { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Spinner, Text, tokens } from '@fluentui/react-components';
import {
  Code24Regular,
  Table24Regular,
  DocumentError24Regular,
} from '@fluentui/react-icons';
import { MONACO_EDITOR_OPTIONS } from './monacoConfig';

export interface DDLViewerProps {
  /** DDL text to display */
  ddlText: string | null | undefined;
  /** Object name (for header display) */
  objectName?: string;
  /** Object type (Table, View, Stored Procedure, Function) */
  objectType?: string;
  /** Schema name */
  schemaName?: string;
  /** Whether DDL is currently loading */
  isLoading?: boolean;
  /** Error message if DDL failed to load */
  error?: string | null;
  /** Height of the editor (default: 100%) */
  height?: string | number;
  /** Show header with object info */
  showHeader?: boolean;
}

export function DDLViewer({
  ddlText,
  objectName,
  objectType,
  schemaName,
  isLoading = false,
  error = null,
  height = '100%',
  showHeader = true,
}: DDLViewerProps) {
  const editorRef = useRef<any>(null);

  // Handle editor mount - configure Ctrl+F find
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Enable Ctrl+F for find
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
  }, []);

  // Determine if this object type has DDL
  const hasDdlType =
    objectType &&
    ['View', 'Stored Procedure', 'Function'].includes(objectType);

  // Render loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: tokens.colorNeutralBackground2,
        }}
      >
        <Spinner size="medium" label="Loading DDL..." />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: tokens.colorNeutralBackground2,
          padding: tokens.spacingVerticalL,
        }}
      >
        <DocumentError24Regular
          style={{
            fontSize: 48,
            color: tokens.colorPaletteRedForeground1,
            marginBottom: tokens.spacingVerticalM,
          }}
        />
        <Text
          weight="semibold"
          style={{ color: tokens.colorPaletteRedForeground1 }}
        >
          Failed to load DDL
        </Text>
        <Text
          size={200}
          style={{
            color: tokens.colorNeutralForeground3,
            marginTop: tokens.spacingVerticalS,
          }}
        >
          {error}
        </Text>
      </div>
    );
  }

  // Render empty state (no DDL)
  if (!ddlText) {
    // Different message for Tables vs objects without DDL
    const isTable = objectType === 'Table';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: tokens.colorNeutralBackground2,
          padding: tokens.spacingVerticalL,
        }}
      >
        {isTable ? (
          <>
            <Table24Regular
              style={{
                fontSize: 48,
                color: tokens.colorNeutralForeground3,
                marginBottom: tokens.spacingVerticalM,
              }}
            />
            <Text
              weight="semibold"
              style={{ color: tokens.colorNeutralForeground2 }}
            >
              Table Definition
            </Text>
            <Text
              size={200}
              style={{
                color: tokens.colorNeutralForeground3,
                marginTop: tokens.spacingVerticalS,
                textAlign: 'center',
              }}
            >
              Tables are defined by their columns and constraints.
              <br />
              DDL is available for Views, Stored Procedures, and Functions.
            </Text>
          </>
        ) : hasDdlType ? (
          <>
            <Code24Regular
              style={{
                fontSize: 48,
                color: tokens.colorNeutralForeground3,
                marginBottom: tokens.spacingVerticalM,
              }}
            />
            <Text
              weight="semibold"
              style={{ color: tokens.colorNeutralForeground2 }}
            >
              No DDL Available
            </Text>
            <Text
              size={200}
              style={{
                color: tokens.colorNeutralForeground3,
                marginTop: tokens.spacingVerticalS,
              }}
            >
              Select an object to view its definition.
            </Text>
          </>
        ) : (
          <>
            <Code24Regular
              style={{
                fontSize: 48,
                color: tokens.colorNeutralForeground3,
                marginBottom: tokens.spacingVerticalM,
              }}
            />
            <Text
              weight="semibold"
              style={{ color: tokens.colorNeutralForeground2 }}
            >
              Select an Object
            </Text>
            <Text
              size={200}
              style={{
                color: tokens.colorNeutralForeground3,
                marginTop: tokens.spacingVerticalS,
              }}
            >
              Click a search result to view its DDL definition.
            </Text>
          </>
        )}
      </div>
    );
  }

  // Render Monaco Editor with DDL
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: tokens.colorNeutralBackground1,
      }}
    >
      {/* Header */}
      {showHeader && objectName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            backgroundColor: tokens.colorNeutralBackground2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <Code24Regular style={{ color: tokens.colorNeutralForeground2 }} />
            <Text weight="semibold">
              {schemaName ? `${schemaName}.${objectName}` : objectName}
            </Text>
            {objectType && (
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  marginLeft: tokens.spacingHorizontalS,
                }}
              >
                {objectType}
              </Text>
            )}
          </div>
          <Text
            size={100}
            style={{ color: tokens.colorNeutralForeground3 }}
          >
            Ctrl+F to search
          </Text>
        </div>
      )}

      {/* Monaco Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="sql"
          value={ddlText}
          options={MONACO_EDITOR_OPTIONS}
          onMount={handleEditorMount}
          theme="vs" // Light theme to match Fabric
        />
      </div>
    </div>
  );
}

export default DDLViewer;
