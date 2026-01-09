/**
 * LineageService - GraphQL Client for Data Lineage
 *
 * Connects to Fabric SQL Database GraphQL API to fetch lineage data.
 * Uses the meta.vw_* views exposed via GraphQL.
 *
 * Features:
 * - Retry logic with exponential backoff (handles cold-start scenarios)
 * - Connection phase callbacks for progress UI
 * - Configurable timeout and retry settings
 *
 * Views:
 * - vw_sources: Source database registry
 * - vw_objects: Objects (tables, views, SPs, functions)
 * - vw_definitions: DDL definitions for views/SPs
 * - vw_lineage_edges: Computed lineage edges
 */

import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { FabricAuthenticationService } from '../../clients/FabricAuthenticationService';
import { FABRIC_BASE_SCOPES } from '../../clients/FabricPlatformScopes';
import { DataNode, ObjectType, REF_TYPE_MAP, ExternalRefType } from './types';

// ============================================================================
// CONNECTION PHASES - For progressive status UI
// ============================================================================

/**
 * Connection phases for progressive loading status
 * Used to show meaningful messages during cold-start scenarios
 */
export enum ConnectionPhase {
  Idle = 'idle',
  Connecting = 'connecting',
  Authenticating = 'authenticating',
  WaitingForService = 'waiting',
  LoadingData = 'loading',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Human-readable messages for each connection phase
 */
export const CONNECTION_PHASE_MESSAGES: Record<ConnectionPhase, string> = {
  [ConnectionPhase.Idle]: 'Ready',
  [ConnectionPhase.Connecting]: 'Connecting to Fabric...',
  [ConnectionPhase.Authenticating]: 'Authenticating...',
  [ConnectionPhase.WaitingForService]: 'Waiting for service to start...',
  [ConnectionPhase.LoadingData]: 'Loading lineage data...',
  [ConnectionPhase.Completed]: 'Data loaded',
  [ConnectionPhase.Failed]: 'Connection failed',
};

/**
 * Progress callback for connection status updates
 */
export type ConnectionProgressCallback = (
  phase: ConnectionPhase,
  message: string,
  attempt?: number,
  maxAttempts?: number
) => void;

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  maxDelayMs: 10000,
  backoffMultiplier: 1.5,
};

// Default GraphQL endpoint - empty for production (users must configure per-item)
export const DEFAULT_GRAPHQL_ENDPOINT = '';

// GraphQL response types
export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: Record<string, unknown>;
}

// View types matching meta.vw_* views in schema-ddl.sql
export interface VwSource {
  source_id: number;
  database_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VwObject {
  source_id: number;
  object_id: number;
  schema_name: string;
  object_name: string;
  object_type: string;
  /** External ref type: 0=LOCAL, 1=FILE, 2=OTHER_DB, 3=LINK */
  ref_type: number;
  /** Full path/URL for external objects (null for local objects) */
  ref_name: string | null;
}

export interface VwDefinition {
  source_id: number;
  object_id: number;
  definition: string | null;
}

export interface VwLineageEdge {
  source_id: number;
  source_object_id: number;
  target_object_id: number;
  is_bidirectional: boolean;
}

// Search result from sp_search_ddl stored procedure
export interface SearchResult {
  source_id: number;
  object_id: number;
  schema_name: string;
  object_name: string;
  object_type: string;
  ddl_text: string | null;
  snippet: string | null;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  sourceCount?: number;
  objectCount?: number;
  edgeCount?: number;
  error?: string;
  timestamp: string;
}

// Extended test result with raw data for dialog display
export interface GraphQLTestResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  timestamp: string;
  query?: string;
  rawResponse?: string;
  availableTypes?: string[];
}

/**
 * LineageService for querying the Data Lineage GraphQL API
 */
export class LineageService {
  private authService: FabricAuthenticationService;
  private graphqlEndpoint: string;
  private retryConfig: RetryConfig;
  private progressCallback?: ConnectionProgressCallback;

  constructor(
    workloadClient: WorkloadClientAPI,
    graphqlEndpoint?: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.authService = new FabricAuthenticationService(workloadClient);
    this.graphqlEndpoint = graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Set the GraphQL endpoint URL
   */
  setEndpoint(endpoint: string): void {
    this.graphqlEndpoint = endpoint;
  }

  /**
   * Get the current GraphQL endpoint URL
   */
  getEndpoint(): string {
    return this.graphqlEndpoint;
  }

  /**
   * Set progress callback for connection status updates
   */
  setProgressCallback(callback: ConnectionProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Clear progress callback
   */
  clearProgressCallback(): void {
    this.progressCallback = undefined;
  }

  /**
   * Report progress to callback if set
   */
  private reportProgress(
    phase: ConnectionPhase,
    message?: string,
    attempt?: number,
    maxAttempts?: number
  ): void {
    if (this.progressCallback) {
      this.progressCallback(
        phase,
        message || CONNECTION_PHASE_MESSAGES[phase],
        attempt,
        maxAttempts
      );
    }
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate delay for retry attempt using exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    const delay = this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Get phase message for retry attempt
   */
  private getRetryPhaseMessage(attempt: number, maxAttempts: number): { phase: ConnectionPhase; message: string } {
    if (attempt === 1) {
      return { phase: ConnectionPhase.Connecting, message: 'Connecting to Fabric...' };
    } else if (attempt === 2) {
      return { phase: ConnectionPhase.Authenticating, message: 'Authenticating with Fabric...' };
    } else if (attempt === maxAttempts) {
      return { phase: ConnectionPhase.WaitingForService, message: 'Final connection attempt...' };
    } else {
      return { phase: ConnectionPhase.WaitingForService, message: 'Waiting for service to start...' };
    }
  }

  /**
   * Format error with detailed debug info
   */
  private formatErrorWithDetails(
    error: unknown,
    context: { status?: number; endpoint?: string; attempt?: number; maxAttempts?: number }
  ): string {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const parts = [baseMessage];

    if (context.status) {
      parts.push(`[HTTP ${context.status}]`);
    }
    if (context.endpoint) {
      // Extract just the host/path for readability
      try {
        const url = new URL(context.endpoint);
        parts.push(`[${url.hostname}]`);
      } catch {
        parts.push(`[${context.endpoint.substring(0, 50)}...]`);
      }
    }
    if (context.attempt && context.maxAttempts) {
      parts.push(`[Attempt ${context.attempt}/${context.maxAttempts}]`);
    }

    return parts.join(' ');
  }

  /**
   * Execute a GraphQL query against the Fabric SQL Database API (single attempt, no retry)
   * Used internally by methods that handle retry at a higher level
   */
  private async executeQueryDirect<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    if (!this.graphqlEndpoint) {
      throw new Error('GraphQL endpoint not configured. Please set the endpoint URL first.');
    }

    // Get access token for Fabric GraphQL API
    // GraphQL API uses Power BI scope (NOT Fabric API scope)
    let token;
    try {
      token = await this.authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);
    } catch (tokenError) {
      const errorMsg = tokenError instanceof Error ? tokenError.message : JSON.stringify(tokenError);
      throw new Error(`Failed to acquire access token: ${errorMsg}`);
    }

    const response = await fetch(this.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const detailedError = this.formatErrorWithDetails(
        `GraphQL request failed: ${errorText}`,
        { status: response.status, endpoint: this.graphqlEndpoint }
      );
      throw new Error(detailedError);
    }

    return await response.json();
  }

  /**
   * Execute a GraphQL query against the Fabric SQL Database API
   * Includes retry logic with exponential backoff for cold-start scenarios
   */
  async executeQuery<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    if (!this.graphqlEndpoint) {
      throw new Error('GraphQL endpoint not configured. Please set the endpoint URL first.');
    }

    let lastError: Error | null = null;
    const { maxAttempts } = this.retryConfig;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Report progress
        const { phase, message } = this.getRetryPhaseMessage(attempt, maxAttempts);
        this.reportProgress(phase, message, attempt, maxAttempts);

        const result = await this.executeQueryDirect<T>(query, variables);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was the last attempt, don't wait
        if (attempt < maxAttempts) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted - format with attempt info
    const finalError = this.formatErrorWithDetails(
      lastError?.message || 'Connection failed',
      { endpoint: this.graphqlEndpoint, attempt: maxAttempts, maxAttempts }
    );
    this.reportProgress(ConnectionPhase.Failed, finalError);
    throw new Error(finalError);
  }

  /**
   * Test connectivity to the GraphQL endpoint
   * Returns basic statistics about available data
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const timestamp = new Date().toISOString();

    try {
      // Query to check connectivity and get counts
      const query = `
        query TestConnection {
          vw_sources(first: 1) {
            items {
              source_id
              database_name
            }
          }
          vw_objects(first: 5) {
            items {
              object_id
              object_name
            }
          }
          vw_lineage_edges(first: 5) {
            items {
              source_object_id
              target_object_id
            }
          }
        }
      `;

      const result = await this.executeQuery<{
        vw_sources: { items: VwSource[] };
        vw_objects: { items: VwObject[] };
        vw_lineage_edges: { items: VwLineageEdge[] };
      }>(query);

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          message: 'GraphQL query returned errors',
          error: result.errors.map((e) => e.message).join('; '),
          timestamp,
        };
      }

      const sources = result.data?.vw_sources?.items || [];
      const objects = result.data?.vw_objects?.items || [];
      const edges = result.data?.vw_lineage_edges?.items || [];

      return {
        success: true,
        message: `Connected! Found ${sources.length} source(s), ${objects.length}+ objects, ${edges.length}+ edges.`,
        sourceCount: sources.length,
        objectCount: objects.length,
        edgeCount: edges.length,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: 'Failed to connect to GraphQL endpoint',
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Test connection with full details for dialog display
   */
  async testConnectionWithDetails(): Promise<GraphQLTestResult> {
    const timestamp = new Date().toISOString();

    // List of view names to try (based on schema-ddl.sql)
    const viewsToTry = ['vw_sources', 'vw_objects', 'vw_definitions', 'vw_lineage_edges'];

    try {
      const availableViews: string[] = [];

      // Try each view
      for (const viewName of viewsToTry) {
        const testQuery = `
          query TestView {
            ${viewName}(first: 1) {
              items {
                __typename
              }
            }
          }
        `;

        try {
          const result = await this.executeQuery<Record<string, { items: Array<{ __typename: string }> }>>(testQuery);

          if (!result.errors && result.data && result.data[viewName]) {
            availableViews.push(viewName);
          }
        } catch {
          // This view doesn't exist or isn't accessible
        }
      }

      if (availableViews.length > 0) {
        return {
          success: true,
          message: `Connected! Found ${availableViews.length} views: ${availableViews.join(', ')}`,
          timestamp,
          availableTypes: availableViews,
        };
      }

      return {
        success: false,
        message: 'No accessible views found in GraphQL API',
        error: 'Please ensure the views (vw_sources, vw_objects, etc.) are exposed in the GraphQL API.',
        timestamp,
        availableTypes: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: 'Failed to connect to GraphQL endpoint',
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Get all sources from the lineage database
   */
  async getSources(): Promise<VwSource[]> {
    const query = `
      query GetSources {
        vw_sources {
          items {
            source_id
            database_name
            description
            is_active
            created_at
          }
        }
      }
    `;

    const result = await this.executeQuery<{
      vw_sources: { items: VwSource[] };
    }>(query);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    return result.data?.vw_sources?.items || [];
  }

  /**
   * Build query for objects (internal helper)
   */
  private buildObjectsQuery(sourceId?: number): string {
    const filterParts: string[] = ['first: 10000'];
    if (sourceId) {
      filterParts.push(`filter: { source_id: { eq: ${sourceId} } }`);
    }
    const args = `(${filterParts.join(', ')})`;
    return `
      query GetObjects {
        vw_objects${args} {
          items {
            source_id
            object_id
            schema_name
            object_name
            object_type
            ref_type
            ref_name
          }
        }
      }
    `;
  }

  /**
   * Build query for definitions (internal helper)
   */
  private buildDefinitionsQuery(sourceId?: number): string {
    const filterParts: string[] = ['first: 10000'];
    if (sourceId) {
      filterParts.push(`filter: { source_id: { eq: ${sourceId} } }`);
    }
    const args = `(${filterParts.join(', ')})`;
    return `
      query GetDefinitions {
        vw_definitions${args} {
          items {
            source_id
            object_id
            definition
          }
        }
      }
    `;
  }

  /**
   * Build query for edges (internal helper)
   */
  private buildEdgesQuery(sourceId?: number): string {
    const filterParts: string[] = ['first: 10000'];
    if (sourceId) {
      filterParts.push(`filter: { source_id: { eq: ${sourceId} } }`);
    }
    const args = `(${filterParts.join(', ')})`;
    return `
      query GetEdges {
        vw_lineage_edges${args} {
          items {
            source_id
            source_object_id
            target_object_id
            is_bidirectional
          }
        }
      }
    `;
  }

  /**
   * Get all objects from the lineage database for a specific source
   * Note: Fabric GraphQL defaults to 100 items per page, we request up to 10000
   */
  async getObjects(sourceId?: number): Promise<VwObject[]> {
    const query = this.buildObjectsQuery(sourceId);
    const result = await this.executeQuery<{
      vw_objects: { items: VwObject[] };
    }>(query);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    return result.data?.vw_objects?.items || [];
  }

  /**
   * Get all definitions from the lineage database for a specific source
   * Note: Fabric GraphQL defaults to 100 items per page, we request up to 10000
   */
  async getDefinitions(sourceId?: number): Promise<VwDefinition[]> {
    const query = this.buildDefinitionsQuery(sourceId);
    const result = await this.executeQuery<{
      vw_definitions: { items: VwDefinition[] };
    }>(query);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    return result.data?.vw_definitions?.items || [];
  }

  /**
   * Get all lineage edges from the database for a specific source
   * Note: Fabric GraphQL defaults to 100 items per page, we request up to 10000
   */
  async getEdges(sourceId?: number): Promise<VwLineageEdge[]> {
    const query = this.buildEdgesQuery(sourceId);
    const result = await this.executeQuery<{
      vw_lineage_edges: { items: VwLineageEdge[] };
    }>(query);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    return result.data?.vw_lineage_edges?.items || [];
  }

  /**
   * Fetch all data in parallel without individual retry (used by getLineageData)
   * Note: DDL definitions are NOT loaded here - they are fetched on-demand via getDdlForObject()
   * This reduces initial load from ~25MB to ~2MB for faster graph rendering.
   */
  private async fetchAllDataDirect(sourceId?: number): Promise<{
    objects: VwObject[];
    definitions: VwDefinition[];
    edges: VwLineageEdge[];
  }> {
    const objectsQuery = this.buildObjectsQuery(sourceId);
    const edgesQuery = this.buildEdgesQuery(sourceId);

    // Execute objects + edges in parallel (DDL loaded on-demand)
    const [objectsResult, edgesResult] = await Promise.all([
      this.executeQueryDirect<{ vw_objects: { items: VwObject[] } }>(objectsQuery),
      this.executeQueryDirect<{ vw_lineage_edges: { items: VwLineageEdge[] } }>(edgesQuery),
    ]);

    // Check for errors
    const errors: string[] = [];
    if (objectsResult.errors) {
      errors.push(`Objects: ${objectsResult.errors.map(e => e.message).join('; ')}`);
    }
    if (edgesResult.errors) {
      errors.push(`Edges: ${edgesResult.errors.map(e => e.message).join('; ')}`);
    }
    if (errors.length > 0) {
      throw new Error(`GraphQL errors: ${errors.join(' | ')}`);
    }

    return {
      objects: objectsResult.data?.vw_objects?.items || [],
      definitions: [], // DDL loaded on-demand via getDdlForObject()
      edges: edgesResult.data?.vw_lineage_edges?.items || [],
    };
  }

  /**
   * Get all lineage data and convert to DataNode[] format for ReactFlow
   * This is the main method used by DefaultView to load data
   *
   * Retry logic is handled at this level (single retry loop for all parallel calls)
   * to avoid confusing "1/3, 2/3, 1/3..." progress from multiple parallel retries.
   *
   * Bidirectional flag is computed in SQL view:
   * - vw_lineage_edges.is_bidirectional: reverse edge exists (A→B AND B→A)
   */
  async getLineageData(sourceId?: number): Promise<DataNode[]> {
    const { maxAttempts } = this.retryConfig;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Report progress (single unified progress for all parallel calls)
        const { phase, message } = this.getRetryPhaseMessage(attempt, maxAttempts);
        this.reportProgress(phase, message, attempt, maxAttempts);

        // Fetch all data in parallel (no individual retry)
        const { objects, definitions, edges } = await this.fetchAllDataDirect(sourceId);

        // Report loading phase
        this.reportProgress(ConnectionPhase.LoadingData, 'Processing lineage data...', attempt, maxAttempts);

        // Success - convert to DataNode format
        return this.convertToDataNodes(objects, definitions, edges);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was the last attempt, don't wait
        if (attempt < maxAttempts) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const finalError = this.formatErrorWithDetails(
      lastError?.message || 'Failed to load lineage data',
      { endpoint: this.graphqlEndpoint, attempt: maxAttempts, maxAttempts }
    );
    this.reportProgress(ConnectionPhase.Failed, finalError);
    throw new Error(finalError);
  }

  /**
   * Convert raw data to DataNode format (extracted for testability)
   */
  private convertToDataNodes(
    objects: VwObject[],
    definitions: VwDefinition[],
    edges: VwLineageEdge[]
  ): DataNode[] {
    // Create lookup maps
    const definitionMap = new Map<number, string>();
    for (const def of definitions) {
      if (def.definition) {
        definitionMap.set(def.object_id, def.definition);
      }
    }

    // Build inputs/outputs and bidirectional info from edges
    const inputsMap = new Map<number, number[]>();
    const outputsMap = new Map<number, number[]>();
    const bidirectionalMap = new Map<number, Set<number>>();

    for (const edge of edges) {
      if (!outputsMap.has(edge.source_object_id)) {
        outputsMap.set(edge.source_object_id, []);
      }
      outputsMap.get(edge.source_object_id)!.push(edge.target_object_id);

      if (!inputsMap.has(edge.target_object_id)) {
        inputsMap.set(edge.target_object_id, []);
      }
      inputsMap.get(edge.target_object_id)!.push(edge.source_object_id);

      if (edge.is_bidirectional) {
        if (!bidirectionalMap.has(edge.source_object_id)) {
          bidirectionalMap.set(edge.source_object_id, new Set());
        }
        bidirectionalMap.get(edge.source_object_id)!.add(edge.target_object_id);
      }
    }

    // Convert to DataNode format
    return objects.map((obj) => {
      const inputs = inputsMap.get(obj.object_id) || [];
      const outputs = outputsMap.get(obj.object_id) || [];
      const bidirectionalIds = bidirectionalMap.get(obj.object_id);
      const refType = Number(obj.ref_type) || 0;
      const isExternal = refType > 0;
      const externalRefType: ExternalRefType | undefined = isExternal
        ? REF_TYPE_MAP[refType]
        : undefined;

      return {
        id: `${obj.source_id}_${obj.object_id}`,
        name: obj.object_name,
        schema: obj.schema_name,
        object_type: obj.object_type as ObjectType,
        inputs: inputs.map((id) => `${obj.source_id}_${id}`),
        outputs: outputs.map((id) => `${obj.source_id}_${id}`),
        ddl_text: definitionMap.get(obj.object_id) || null,
        bidirectional_with: bidirectionalIds
          ? Array.from(bidirectionalIds).map((id) => `${obj.source_id}_${id}`)
          : [],
        is_external: isExternal,
        external_ref_type: externalRefType,
        ref_name: obj.ref_name || undefined,
      };
    });
  }

  /**
   * Search DDL definitions via GraphQL query (stored procedure)
   *
   * Calls meta.sp_search_ddl stored procedure exposed as GraphQL query.
   * Note: SPs with only SELECT are exposed as queries, not mutations.
   * See: https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-stored-procedures
   *
   * @param query - Search term (case-insensitive substring match)
   * @param schemas - Optional comma-separated schema names to filter
   * @param types - Optional comma-separated object types to filter
   * @param sourceId - Optional source database ID
   */
  async searchDdl(
    query: string,
    schemas?: string,
    types?: string,
    sourceId?: number
  ): Promise<SearchResult[]> {
    // Call stored procedure as GraphQL query (SELECT-only SPs are queries, not mutations)
    // SP results are returned directly as an array, not wrapped in a "result" field
    const gqlQuery = `
      query SearchDdl($query: String!, $schemas: String, $types: String, $source_id: Int) {
        executesp_search_ddl(query: $query, schemas: $schemas, types: $types, source_id: $source_id) {
          source_id
          object_id
          schema_name
          object_name
          object_type
          ddl_text
          snippet
        }
      }
    `;

    const variables = {
      query,
      schemas: schemas || null,
      types: types || null,
      source_id: sourceId || null,
    };

    const result = await this.executeQuery<{
      executesp_search_ddl: SearchResult[];
    }>(gqlQuery, variables);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    return result.data?.executesp_search_ddl || [];
  }

  /**
   * Get DDL for a single object by ID (on-demand loading)
   * Uses searchDdl with empty query to get all DDL, then filters by object_id.
   * This avoids needing a new stored procedure.
   *
   * @param objectId - Object ID to fetch DDL for
   * @param sourceId - Optional source database ID
   * @returns DDL text or null if not found
   */
  async getDdlForObject(objectId: number, sourceId?: number): Promise<string | null> {
    // Use getDefinitions to fetch single object's DDL
    // This is more efficient than searchDdl for targeted fetches
    const query = `
      query GetDdlForObject($object_id: Int!, $source_id: Int) {
        vw_definitions(filter: { object_id: { eq: $object_id }, source_id: { eq: $source_id } }, first: 1) {
          items {
            definition
          }
        }
      }
    `;

    const variables = {
      object_id: objectId,
      source_id: sourceId ?? null,
    };

    const result = await this.executeQuery<{
      vw_definitions: { items: Array<{ definition: string | null }> };
    }>(query, variables);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    const items = result.data?.vw_definitions?.items || [];
    return items.length > 0 ? items[0].definition : null;
  }

  /**
   * Set active source database via GraphQL mutation (stored procedure)
   *
   * Calls meta.sp_set_active_source stored procedure exposed as GraphQL mutation.
   * SPs with UPDATE/INSERT/DELETE are exposed as mutations.
   * See: https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-stored-procedures
   *
   * @param sourceId - Source database ID to activate (optional)
   *                   If not provided: ensures first alphabetical source is active (if none active)
   *                   If provided: deactivates current, activates specified source
   */
  async setActiveSource(sourceId?: number): Promise<void> {
    // Call stored procedure as GraphQL mutation (UPDATE SPs are mutations)
    // Note: Fabric GraphQL may use different naming conventions:
    // - executesp_set_active_source (without schema prefix)
    // - executemeta_sp_set_active_source (with schema prefix)
    const mutation = `
      mutation SetActiveSource($source_id: Int) {
        executesp_set_active_source(source_id: $source_id) {
          __typename
        }
      }
    `;

    const variables = {
      source_id: sourceId ?? null,
    };

    const result = await this.executeQuery<{
      executesp_set_active_source: unknown;
    }>(mutation, variables);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }
  }
}

/**
 * Create a LineageService instance
 */
export function createLineageService(workloadClient: WorkloadClientAPI, graphqlEndpoint?: string): LineageService {
  return new LineageService(workloadClient, graphqlEndpoint);
}
