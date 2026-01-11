/**
 * DataLineageItem Definition
 *
 * This interface defines the state that gets persisted to Fabric
 * via the ItemCRUDController.saveWorkloadItem() function.
 *
 * Configuration is organized into:
 * - Connection: GraphQL endpoint, sample data toggle
 * - Data Model: Classification patterns, exclude patterns
 * - Preferences: UI/UX preferences
 * - Filter State: Current filter selections (session state)
 */

import { ObjectType, TraceConfig, ExternalRefType } from './types';

/**
 * Available shape icons for data model types
 * These are standard FluentUI geometric shape icons
 */
export type DataModelIcon =
  | 'Circle'
  | 'Square'
  | 'Diamond'
  | 'Triangle'
  | 'Hexagon'
  | 'Star';

/**
 * Data model type classification rule
 * Allows users to define patterns for auto-classifying objects
 */
export interface DataModelTypeRule {
  name: string;           // e.g., "Dimension", "Fact", "Other"
  patterns: string[];     // Prefix patterns: ["dim", "dim_"] (case-insensitive, matches start)
  icon: DataModelIcon;    // Shape icon to display on nodes
  isDefault?: boolean;    // If true, catches all unmatched objects (cannot be deleted)
}

/**
 * Data model configuration
 * Defines how objects are classified and which should be excluded
 */
export interface DataModelConfig {
  types: DataModelTypeRule[];
  excludePatterns: string[];  // Patterns to hide: ["*_VAT", "*_BACKUP"]
}

/**
 * Edge type for ReactFlow connections
 * - bezier: Curved lines (default, may cross over nodes)
 * - smoothstep: Right-angle with rounded corners (routes around nodes)
 * - step: Right-angle with sharp corners
 * - straight: Direct lines
 */
export type EdgeType = 'bezier' | 'smoothstep' | 'step' | 'straight';

/**
 * Theme mode preference
 * - auto: Inherit from Fabric (or system if Fabric doesn't provide)
 * - light: Force light mode
 * - dark: Force dark mode
 */
export type ThemeMode = 'auto' | 'light' | 'dark';

/**
 * User preferences for the visualization
 * These are persisted per-item and shared with team members
 */
export interface UserPreferences {
  // Layout
  layoutDirection: 'LR' | 'TB';

  // Theme
  themeMode: ThemeMode;

  // Canvas display (configured in Settings Panel, not in canvas)
  showMinimap: boolean;
  showControls: boolean;        // Zoom +/- buttons
  edgeType: EdgeType;           // Line routing style

  // Behavior
  hideIsolated: boolean;
  rememberFilters: boolean;
  focusSchema?: string | null;  // Single schema marked as "focus" - shows focus + direct neighbors

  // Trace defaults (right-click on node triggers trace with these levels)
  defaultUpstreamLevels: number;
  defaultDownstreamLevels: number;
}

/**
 * Main item definition - persisted to Fabric
 */
export interface DataLineageItemDefinition {
  // ============================================
  // CONNECTION SETTINGS
  // ============================================
  graphqlEndpoint?: string;
  useSampleData?: boolean;
  warehouseId?: string;

  // ============================================
  // DATA MODEL CONFIGURATION
  // ============================================
  dataModelConfig?: DataModelConfig;

  // ============================================
  // USER PREFERENCES
  // ============================================
  preferences?: UserPreferences;

  // ============================================
  // FILTER STATE (persisted to Fabric on explicit Save)
  // Also cached in localStorage for session persistence
  // ============================================
  selectedSchemas?: string[];
  selectedObjectTypes?: ObjectType[];
  selectedDataModelTypes?: string[];        // Data model type filter (Dimension, Fact, Other)
  selectedExternalTypes?: ExternalRefType[]; // External object type filter (FILE, OTHER_DB, LINK)

  // ============================================
  // TRACE MODE (session state)
  // ============================================
  activeTrace?: TraceConfig;

  // ============================================
  // METADATA
  // ============================================
  lastRefreshed?: string;
}

/**
 * Default data model classification patterns
 * Based on common data warehouse naming conventions
 * Patterns are case-insensitive prefix matches (e.g., "dim" matches "DimCustomer", "dim_customer")
 */
export const DEFAULT_DATA_MODEL_TYPES: DataModelTypeRule[] = [
  {
    name: 'Dimension',
    patterns: ['dim'],  // Matches: DimCustomer, dim_customer, Dimension, etc.
    icon: 'Diamond',
  },
  {
    name: 'Fact',
    patterns: ['fact'],  // Matches: FactSales, fact_orders, etc.
    icon: 'Square',
  },
  {
    name: 'Other',
    patterns: [],  // Catches all unmatched objects
    icon: 'Circle',
    isDefault: true,  // Cannot be deleted
  },
];

/**
 * Default exclude patterns
 * Common patterns for objects that should be hidden by default
 */
export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  // Add common patterns to exclude
  // '*_VAT',
  // '*_BACKUP',
  // '*_OLD',
  // '*_TEMP',
];

/**
 * Default user preferences
 * Defaults match current design behavior
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  // Layout
  layoutDirection: 'LR',

  // Theme
  themeMode: 'auto',

  // Canvas display
  showMinimap: true,
  showControls: true,
  edgeType: 'bezier',  // Current default - curved lines

  // Behavior
  hideIsolated: false,
  rememberFilters: true,
  focusSchema: null,

  // Trace defaults
  defaultUpstreamLevels: 1,
  defaultDownstreamLevels: 1,
};

/**
 * Default item definition
 */
export const DEFAULT_DEFINITION: DataLineageItemDefinition = {
  // Connection
  useSampleData: true,
  graphqlEndpoint: undefined,

  // Data Model
  dataModelConfig: {
    types: DEFAULT_DATA_MODEL_TYPES,
    excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
  },

  // Preferences
  preferences: DEFAULT_PREFERENCES,

  // Filter state
  selectedSchemas: [],
  selectedObjectTypes: ['Table', 'View', 'Stored Procedure', 'Function'],

  // Metadata
  lastRefreshed: undefined,
};

/**
 * Migrate old regex patterns to simple prefix patterns
 * Strips regex anchors (^, $) and wildcards (*, .)
 */
function migratePattern(pattern: string): string {
  // Remove regex anchors and common wildcards
  return pattern
    .replace(/^\^/, '')    // Remove leading ^
    .replace(/\$$/, '')    // Remove trailing $
    .replace(/\.\*$/, '')  // Remove trailing .*
    .replace(/\*$/, '')    // Remove trailing *
    .trim();
}

/**
 * Migrate old data model types to new format
 * - Splits patterns that were incorrectly stored with semicolons
 * - Cleans up regex patterns
 * - Ensures icons are valid
 * - Ensures there's always a default "Other" type with isDefault: true
 */
function migrateDataModelTypes(types: DataModelTypeRule[]): DataModelTypeRule[] {
  const validIcons: DataModelIcon[] = ['Circle', 'Square', 'Diamond', 'Triangle', 'Hexagon', 'Star'];

  // Migrate each type
  let migratedTypes = types.map(type => {
    // Fix patterns that were stored with semicolons (split them)
    const rawPatterns = type.patterns || [];
    const splitPatterns = rawPatterns.flatMap(p => p.split(';').map(s => s.trim()));
    const cleanedPatterns = splitPatterns.map(migratePattern).filter(p => p.length > 0);

    return {
      ...type,
      patterns: cleanedPatterns,
      icon: (type.icon && validIcons.includes(type.icon)) ? type.icon : 'Circle',
    };
  });

  // Ensure there's exactly one default type
  const hasDefault = migratedTypes.some(t => t.isDefault === true);
  if (!hasDefault) {
    // Check if there's an "Other" type that should be default
    const otherIndex = migratedTypes.findIndex(t => t.name.toLowerCase() === 'other');
    if (otherIndex >= 0) {
      migratedTypes[otherIndex] = { ...migratedTypes[otherIndex], isDefault: true };
    } else {
      // Add the default "Other" type
      migratedTypes.push({
        name: 'Other',
        patterns: [],
        icon: 'Circle',
        isDefault: true,
      });
    }
  }

  return migratedTypes;
}

/**
 * Helper to merge partial definition with defaults
 * Also migrates old patterns to new format
 *
 * IMPORTANT: Explicitly preserves user-defined values for:
 * - dataModelConfig.types (migrated)
 * - dataModelConfig.excludePatterns
 * - preferences
 */
export function mergeWithDefaults(
  partial: Partial<DataLineageItemDefinition>
): DataLineageItemDefinition {
  // Build dataModelConfig, preserving user values
  let migratedDataModelConfig: DataModelConfig;

  if (partial.dataModelConfig) {
    // User has dataModelConfig - preserve their values
    const userTypes = partial.dataModelConfig.types;
    const userExcludePatterns = partial.dataModelConfig.excludePatterns;

    migratedDataModelConfig = {
      // Start with defaults
      ...DEFAULT_DEFINITION.dataModelConfig,
      // Apply user's config (may override some defaults)
      ...partial.dataModelConfig,
      // Explicitly set types (migrated) - only use defaults if user has none
      types: migrateDataModelTypes(
        userTypes && userTypes.length > 0 ? userTypes : DEFAULT_DATA_MODEL_TYPES
      ),
      // Explicitly preserve excludePatterns - use user's value or default to empty
      excludePatterns: userExcludePatterns ?? DEFAULT_DEFINITION.dataModelConfig.excludePatterns,
    };
  } else {
    // No user dataModelConfig - use defaults
    migratedDataModelConfig = DEFAULT_DEFINITION.dataModelConfig;
  }

  const result: DataLineageItemDefinition = {
    ...DEFAULT_DEFINITION,
    ...partial,
    dataModelConfig: migratedDataModelConfig,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...partial.preferences,
    },
  };

  return result;
}

/**
 * Convert a SQL LIKE style pattern to a RegExp
 * - % matches any characters (0 or more)
 * - Without %, pattern matches as prefix (for backward compatibility)
 *
 * Examples:
 * - "dim" or "dim%" → starts with "dim"
 * - "%dim" → ends with "dim"
 * - "%dim%" → contains "dim"
 */
export function patternToRegex(pattern: string): RegExp {
  const hasStartWildcard = pattern.startsWith('%');
  const hasEndWildcard = pattern.endsWith('%');

  // Remove wildcards and escape special regex chars
  let core = pattern.replace(/^%/, '').replace(/%$/, '');
  const escaped = core.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');

  // Build regex based on wildcard positions
  let regexStr: string;
  if (hasStartWildcard && hasEndWildcard) {
    // %pattern% = contains
    regexStr = escaped;
  } else if (hasStartWildcard) {
    // %pattern = ends with
    regexStr = escaped + '$';
  } else {
    // pattern or pattern% = starts with (default behavior)
    regexStr = '^' + escaped;
  }

  return new RegExp(regexStr, 'i');
}

/**
 * Classify an object name based on data model type rules
 * Returns the matching type or the default "Other" type
 *
 * Pattern syntax (SQL LIKE style):
 * - "dim" or "dim%" → matches names starting with "dim"
 * - "%dim" → matches names ending with "dim"
 * - "%dim%" → matches names containing "dim"
 */
export function classifyObject(
  objectName: string,
  types: DataModelTypeRule[]
): DataModelTypeRule {
  // Find first matching type (order matters)
  for (const type of types) {
    if (type.isDefault) continue; // Skip default type during matching

    for (const pattern of type.patterns) {
      const regex = patternToRegex(pattern);
      if (regex.test(objectName)) {
        return type;
      }
    }
  }

  // Return default type (Other) or fallback
  const defaultType = types.find(t => t.isDefault);
  return defaultType || { name: 'Other', patterns: [], icon: 'Circle', isDefault: true };
}

/**
 * Get all available data model icons
 */
export const AVAILABLE_ICONS: DataModelIcon[] = [
  'Circle',
  'Square',
  'Diamond',
  'Triangle',
  'Hexagon',
  'Star',
];

/**
 * Configuration for which icons should use filled style
 * Circle stays Regular (outline) for "Other" type, all others are Filled
 */
export const FILLED_ICON_TYPES: DataModelIcon[] = [
  'Square',
  'Diamond',
  'Triangle',
  'Hexagon',
  'Star',
];

/**
 * Check if an icon should use filled style
 */
export function shouldUseFilled(icon: DataModelIcon): boolean {
  return FILLED_ICON_TYPES.includes(icon);
}

/**
 * Available edge types for ReactFlow
 * Used in Settings Panel dropdown
 */
export const AVAILABLE_EDGE_TYPES: { value: EdgeType; label: string }[] = [
  { value: 'bezier', label: 'Curved (Bezier)' },
  { value: 'smoothstep', label: 'Right-angle (Smooth)' },
  { value: 'step', label: 'Right-angle (Sharp)' },
  { value: 'straight', label: 'Straight' },
];
