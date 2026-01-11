/**
 * Monaco Editor Configuration
 *
 * Shared configuration for Monaco Editor instances used in:
 * - DDLViewerPanel (side panel)
 * - DataLineageSearchOverlay (full-text search)
 *
 * CRITICAL: domReadOnly must be true to prevent editor from capturing
 * keyboard events from search inputs and other form elements.
 */

import type { EditorProps } from '@monaco-editor/react';

// Constants for Detail Search resizable panels
export const DETAIL_SEARCH_HEIGHT_DEFAULT_PCT = 25;
export const DETAIL_SEARCH_HEIGHT_MIN_PCT = 15;
export const DETAIL_SEARCH_HEIGHT_MAX_PCT = 60;

// Search debounce timing
export const SEARCH_DEBOUNCE_MS = 300;

// Monaco Editor options for read-only SQL viewing
export const MONACO_EDITOR_OPTIONS: EditorProps['options'] = {
  // Read-only mode
  readOnly: true,
  domReadOnly: true, // CRITICAL: Prevents keyboard capture from search inputs

  // Layout
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  fontSize: 14,
  lineNumbers: 'on',
  lineNumbersMinChars: 3,
  folding: true,
  foldingHighlight: true,

  // Appearance
  renderWhitespace: 'selection',
  overviewRulerBorder: true,
  overviewRulerLanes: 3,
  renderLineHighlight: 'line',
  cursorStyle: 'line',
  cursorBlinking: 'blink',

  // Scrollbars
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    verticalScrollbarSize: 14,
    horizontalScrollbarSize: 14,
    useShadows: true,
  },

  // Find dialog configuration
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'always',
    cursorMoveOnType: false,
  },

  // Disable hover hints that cause flickering
  hover: {
    enabled: false,
  },

  // Performance
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: 'off',
  tabCompletion: 'off',
  parameterHints: { enabled: false },

  // Disable editing features
  contextmenu: false,
  selectionHighlight: true,
  occurrencesHighlight: 'off',
};

// Search result scoring weights
export const SEARCH_SCORE = {
  NAME_STARTS_WITH: 10,
  NAME_CONTAINS: 5,
  DESCRIPTION_CONTAINS: 2,
  DDL_CONTAINS: 1,
};

// Import centralized theme colors
import { getThemeColors } from './useReactFlowTheme';

// Object type icons (static) and colors (theme-aware)
export const OBJECT_TYPE_ICONS: Record<string, string> = {
  Table: 'Table',
  View: 'View',
  'Stored Procedure': 'Code',
  Function: 'Variable',
};

/**
 * Get object type configuration with theme-aware colors
 * Call this function to get colors that adapt to light/dark mode
 */
export function getObjectTypeConfig(): Record<string, { icon: string; color: string }> {
  const colors = getThemeColors().objectTypeColors;
  return {
    Table: { icon: 'Table', color: colors.Table },
    View: { icon: 'View', color: colors.View },
    'Stored Procedure': { icon: 'Code', color: colors.StoredProcedure },
    Function: { icon: 'Variable', color: colors.Function },
  };
}

