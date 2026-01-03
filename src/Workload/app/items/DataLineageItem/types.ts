/**
 * Data Lineage Types
 */

export type ObjectType = 'Table' | 'View' | 'Stored Procedure' | 'Function' | 'External';
/** User-defined data model type (configured in Settings → Data Model Types) */
export type DataModelType = string;

/**
 * External reference types (from backend ref_type column)
 * - FILE (1): Storage paths (abfss://, blob URLs)
 * - OTHER_DB (2): 3-part names (database.schema.table)
 * - LINK (3): External HTTP endpoints
 */
export type ExternalRefType = 'FILE' | 'OTHER_DB' | 'LINK';

/** Map from backend ref_type number to ExternalRefType string */
export const REF_TYPE_MAP: Record<number, ExternalRefType> = {
  1: 'FILE',
  2: 'OTHER_DB',
  3: 'LINK',
};

/** All external reference types for filter defaults */
export const ALL_EXTERNAL_TYPES: ExternalRefType[] = ['FILE', 'OTHER_DB', 'LINK'];

export interface DataNode {
  id: string;
  name: string;
  schema: string;
  object_type: ObjectType;
  description?: string;
  data_model_type?: DataModelType;
  inputs: string[];
  outputs: string[];
  bidirectional_with?: string[];
  ddl_text?: string | null;
  node_symbol?: 'circle' | 'diamond' | 'square' | 'question_mark';
  /** External reference type (FILE, OTHER_DB, LINK) - only set for External objects */
  external_ref_type?: ExternalRefType;
  /** Whether this is an external object (object_type === 'External') */
  is_external?: boolean;
  /** Full path/URL for external objects (from ref_name column) */
  ref_name?: string;
}

export interface TraceConfig {
  startNodeId: string | null;
  endNodeId?: string | null;
  upstreamLevels: number;
  downstreamLevels: number;
}

export interface FilterConfig {
  selectedSchemas: string[];
  selectedObjectTypes: ObjectType[];
  excludePatterns: string[];
  hideIsolated: boolean;
}
