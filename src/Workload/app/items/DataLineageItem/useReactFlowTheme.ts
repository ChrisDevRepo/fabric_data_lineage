/**
 * Centralized Theme System for Data Lineage Visualization
 *
 * Provides theme-aware colors for all visual elements:
 * - ReactFlow edges, controls, minimap, background
 * - Schema colors (node borders/backgrounds)
 * - Object type colors (Monaco, minimap fallback)
 * - Export backgrounds
 *
 * Automatically detects Fabric's light/dark mode.
 *
 * Usage:
 *   import { getThemeColors, useReactFlowTheme } from './useReactFlowTheme';
 *   const colors = getThemeColors(); // Sync access
 *   const { colors, isDarkMode } = useReactFlowTheme(workloadClient); // Hook with live updates
 */

import { useState, useEffect, useMemo } from 'react';
import { WorkloadClientAPI, ThemeConfiguration } from '@ms-fabric/workload-client';
import { callThemeGet } from '../../controller/ThemeController';

// ============================================================================
// SCHEMA COLORS - Used for node borders, backgrounds, legend
// ============================================================================

/**
 * Schema color palette based on Tableau 10
 * Industry-standard palette for data visualization:
 * - Colorblind-safe (CVD-friendly)
 * - Print/export friendly (distinguishable in grayscale)
 * - Professional appearance for business reporting
 * - Tested with millions of users in BI applications
 *
 * Reference: https://www.tableau.com/blog/colors-upgrade-702
 */
const SCHEMA_COLORS_LIGHT = [
  '#4E79A7', // Blue (primary)
  '#F28E2B', // Orange
  '#E15759', // Red
  '#76B7B2', // Teal
  '#59A14F', // Green
  '#EDC948', // Yellow
  '#B07AA1', // Purple
  '#FF9DA7', // Pink
  '#9C755F', // Brown
  '#BAB0AC', // Gray
];

/**
 * Dark mode schema colors - Tableau 10 with HSL-based adaptation
 * Methodology: Same hue, +20% lightness, -10% saturation
 * This maintains color identity while ensuring visibility on dark backgrounds
 *
 * Original HSL → Dark HSL transformations:
 * Blue:   hsl(211, 39%, 48%) → hsl(211, 35%, 62%)
 * Orange: hsl(30, 89%, 56%)  → hsl(30, 80%, 68%)
 * Red:    hsl(359, 69%, 61%) → hsl(359, 62%, 72%)
 * Teal:   hsl(174, 27%, 58%) → hsl(174, 24%, 70%)
 * Green:  hsl(105, 37%, 47%) → hsl(105, 33%, 60%)
 * Yellow: hsl(45, 80%, 61%)  → hsl(45, 72%, 73%)
 * Purple: hsl(315, 22%, 66%) → hsl(315, 20%, 76%)
 * Pink:   hsl(352, 100%, 81%) → hsl(352, 90%, 88%)
 * Brown:  hsl(24, 26%, 49%)  → hsl(24, 23%, 62%)
 * Gray:   hsl(24, 6%, 70%)   → hsl(24, 5%, 80%)
 */
const SCHEMA_COLORS_DARK = [
  '#7BA3CA', // Blue
  '#FFB866', // Orange
  '#F28B8D', // Red
  '#9DD4CE', // Teal
  '#7FC472', // Green
  '#F5DE7A', // Yellow
  '#CBADBD', // Purple
  '#FFCDD2', // Pink
  '#BDA08A', // Brown
  '#D4CDCA', // Gray
];

// ============================================================================
// OBJECT TYPE COLORS - Used for Monaco syntax highlighting, minimap fallback
// ============================================================================

interface ObjectTypeColors {
  Table: string;
  View: string;
  StoredProcedure: string;
  Function: string;
}

/**
 * Object type colors from Tableau 10 palette
 * Consistent with schema colors for unified visual language
 */
const OBJECT_TYPE_COLORS_LIGHT: ObjectTypeColors = {
  Table: '#4E79A7',      // Blue - primary data storage
  View: '#59A14F',       // Green - derived/computed
  StoredProcedure: '#F28E2B', // Orange - executable logic
  Function: '#B07AA1',   // Purple - reusable logic
};

/**
 * Dark mode: Same HSL methodology (+20% lightness, -10% saturation)
 */
const OBJECT_TYPE_COLORS_DARK: ObjectTypeColors = {
  Table: '#7BA3CA',      // Blue
  View: '#7FC472',       // Green
  StoredProcedure: '#FFB866', // Orange
  Function: '#CBADBD',   // Purple
};

// ============================================================================
// REACTFLOW COLORS - Edges, controls, minimap, background
// ============================================================================

/**
 * Complete color palette for ReactFlow elements
 */
export interface ThemeColors {
  // Edge colors
  edgeDefault: string;
  edgeDimmed: string;
  edgeTraced: string;

  // Edge label background (for bidirectional markers)
  edgeLabelBackground: string;

  // Background
  backgroundDots: string;
  canvasBackground: string;

  // Controls
  controlsBackground: string;
  controlsBorder: string;

  // Export background
  exportBackground: string;

  // Schema colors array
  schemaColors: string[];

  // Object type colors
  objectTypeColors: ObjectTypeColors;

  // Node fallback color (when no schema color)
  nodeFallbackColor: string;
}

/**
 * Light mode color palette
 */
const LIGHT_COLORS: ThemeColors = {
  // Edges
  edgeDefault: '#b8b8b8',
  edgeDimmed: '#e0e0e0',
  edgeTraced: '#0078d4',
  edgeLabelBackground: '#ffffff',

  // Background
  backgroundDots: '#aaaaaa',
  canvasBackground: '#ffffff',

  // Controls
  controlsBackground: '#ffffff',
  controlsBorder: '#e0e0e0',

  // Export
  exportBackground: '#ffffff',

  // Schema colors
  schemaColors: SCHEMA_COLORS_LIGHT,

  // Object types
  objectTypeColors: OBJECT_TYPE_COLORS_LIGHT,

  // Node fallback
  nodeFallbackColor: '#7f7f7f',
};

/**
 * Dark mode color palette
 */
const DARK_COLORS: ThemeColors = {
  // Edges
  edgeDefault: '#6b6b6b',
  edgeDimmed: '#404040',
  edgeTraced: '#4da6ff',
  edgeLabelBackground: '#2d2d2d',

  // Background
  backgroundDots: '#444444',
  canvasBackground: '#1e1e1e',

  // Controls
  controlsBackground: '#2d2d2d',
  controlsBorder: '#404040',

  // Export
  exportBackground: '#1e1e1e',

  // Schema colors
  schemaColors: SCHEMA_COLORS_DARK,

  // Object types
  objectTypeColors: OBJECT_TYPE_COLORS_DARK,

  // Node fallback
  nodeFallbackColor: '#808080',
};

// ============================================================================
// THEME DETECTION
// ============================================================================

// Cache for current dark mode state
let cachedIsDarkMode = false;

/**
 * Detect if current theme is dark mode
 * Uses CSS custom properties set by Fabric
 */
function detectDarkMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Try to detect from Fabric's applied styles via CSS custom property
  const root = document.documentElement;
  const bgColor = getComputedStyle(root).getPropertyValue('--colorNeutralBackground1').trim();

  if (bgColor) {
    // Parse hex or rgb color
    let r = 255, g = 255, b = 255;

    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    } else if (bgColor.startsWith('rgb')) {
      const match = bgColor.match(/\d+/g);
      if (match && match.length >= 3) {
        r = parseInt(match[0], 10);
        g = parseInt(match[1], 10);
        b = parseInt(match[2], 10);
      }
    }

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    cachedIsDarkMode = luminance < 0.5;
    return cachedIsDarkMode;
  }

  // Fallback to prefers-color-scheme
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    cachedIsDarkMode = true;
    return true;
  }

  return cachedIsDarkMode;
}

/**
 * Detect if theme is dark mode from Fabric theme configuration
 */
function isDarkTheme(theme: ThemeConfiguration): boolean {
  const themeName = theme.name?.toLowerCase() || '';

  // Check theme name for dark indicators
  if (themeName.includes('dark') || themeName.includes('night') || themeName.includes('black')) {
    cachedIsDarkMode = true;
    return true;
  }

  // Check if theme name indicates light mode
  if (themeName.includes('light') || themeName.includes('white') || themeName.includes('default')) {
    cachedIsDarkMode = false;
    return false;
  }

  // Fallback: check background color token if available
  const tokens = theme.tokens as Record<string, string>;
  const bgColor = tokens?.colorNeutralBackground1 || tokens?.['colorNeutralBackground1'];

  if (bgColor) {
    const hex = bgColor.replace('#', '');
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      cachedIsDarkMode = luminance < 0.5;
      return cachedIsDarkMode;
    }
  }

  return cachedIsDarkMode;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Theme mode override type
 * - 'auto': Inherit from Fabric (or system if Fabric doesn't provide)
 * - 'light': Force light mode
 * - 'dark': Force dark mode
 */
export type ThemeModeOverride = 'auto' | 'light' | 'dark';

/**
 * Get theme colors synchronously (uses cached dark mode detection)
 * Use this for immediate access in render functions and callbacks
 *
 * @param themeMode - Optional override: 'auto' (default), 'light', or 'dark'
 */
export function getThemeColors(themeMode: ThemeModeOverride = 'auto'): ThemeColors {
  if (themeMode === 'light') return LIGHT_COLORS;
  if (themeMode === 'dark') return DARK_COLORS;
  const isDark = detectDarkMode();
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

/**
 * Get schema color by index (wraps around if needed)
 * Use this for consistent schema coloring across components
 */
export function getSchemaColorByIndex(index: number): string {
  const colors = getThemeColors().schemaColors;
  return colors[Math.abs(index) % colors.length];
}

/**
 * Get schema color by name (deterministic hash-based assignment)
 * Returns same color for same schema name, adapts to theme
 */
export function getSchemaColorByName(schemaName: string): string {
  // Hash the schema name to get a consistent index
  let hash = 0;
  for (let i = 0; i < schemaName.length; i++) {
    const char = schemaName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return getSchemaColorByIndex(hash);
}

/**
 * Check if currently in dark mode
 */
export function isDarkMode(): boolean {
  return detectDarkMode();
}

/**
 * Hook to get theme colors with live updates from Fabric theme API
 * Use this in React components that need to respond to theme changes
 *
 * @param workloadClient - Fabric workload client for theme API access
 * @param themeMode - Optional override: 'auto' (default), 'light', or 'dark'
 * @returns Theme colors and dark mode flag
 */
export function useReactFlowTheme(
  workloadClient?: WorkloadClientAPI,
  themeMode: ThemeModeOverride = 'auto'
): {
  colors: ThemeColors;
  isDarkMode: boolean;
} {
  const [fabricIsDark, setFabricIsDark] = useState(detectDarkMode);

  useEffect(() => {
    if (!workloadClient) return;

    // Get initial theme
    callThemeGet(workloadClient)
      .then((theme) => {
        setFabricIsDark(isDarkTheme(theme));
      })
      .catch((err) => {
        console.warn('Failed to get Fabric theme:', err);
      });

    // Listen for theme changes
    const handleThemeChange = (theme: ThemeConfiguration) => {
      setFabricIsDark(isDarkTheme(theme));
    };

    try {
      workloadClient.theme.onChange(handleThemeChange);
    } catch (err) {
      console.warn('Failed to register theme change listener:', err);
    }
  }, [workloadClient]);

  // Apply theme mode override
  const isDark = useMemo(() => {
    if (themeMode === 'light') return false;
    if (themeMode === 'dark') return true;
    return fabricIsDark; // 'auto' - use Fabric's theme
  }, [themeMode, fabricIsDark]);

  const colors = useMemo(() => {
    return isDark ? DARK_COLORS : LIGHT_COLORS;
  }, [isDark]);

  return { colors, isDarkMode: isDark };
}

