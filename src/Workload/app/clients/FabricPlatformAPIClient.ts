import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { WorkspaceClient } from "./WorkspaceClient";
import { ItemClient } from "./ItemClient";
import { FolderClient } from "./FolderClient";
import { CapacityClient } from "./CapacityClient";
import { ConnectionClient } from "./ConnectionClient";
import { JobSchedulerClient } from "./JobSchedulerClient";
import { LongRunningOperationsClient } from "./LongRunningOperationsClient";
import { ExternalDataSharesProviderClient } from "./ExternalDataSharesProviderClient";
import { ExternalDataSharesRecipientClient } from "./ExternalDataSharesRecipientClient";
import { TagsClient } from "./TagsClient";

/**
 * Comprehensive Fabric Platform API Client
 * Provides unified access to all Fabric platform APIs through individual clients
 *
 * NOTE: This client uses delegated (user) authentication only.
 * Service principal authentication is NOT supported in the Fabric iframe SDK.
 */
export class FabricPlatformAPIClient {
  public readonly workspaces: WorkspaceClient;
  public readonly items: ItemClient;
  public readonly folders: FolderClient;
  public readonly capacities: CapacityClient;
  public readonly connections: ConnectionClient;
  public readonly scheduler: JobSchedulerClient;
  public readonly operations: LongRunningOperationsClient;
  public readonly externalDataShares: ExternalDataSharesProviderClient;
  public readonly externalDataSharesRecipient: ExternalDataSharesRecipientClient;
  public readonly tags: TagsClient;

  constructor(workloadClient: WorkloadClientAPI) {
    this.workspaces = new WorkspaceClient(workloadClient);
    this.items = new ItemClient(workloadClient);
    this.folders = new FolderClient(workloadClient);
    this.capacities = new CapacityClient(workloadClient);
    this.connections = new ConnectionClient(workloadClient);
    this.scheduler = new JobSchedulerClient(workloadClient);
    this.operations = new LongRunningOperationsClient(workloadClient);
    this.externalDataShares = new ExternalDataSharesProviderClient(workloadClient);
    this.externalDataSharesRecipient = new ExternalDataSharesRecipientClient(workloadClient);
    this.tags = new TagsClient(workloadClient);
  }

  /**
   * Factory method to create a new FabricPlatformAPIClient instance
   * @param workloadClient The WorkloadClientAPI instance
   * @returns FabricPlatformAPIClient
   */
  static create(workloadClient: WorkloadClientAPI): FabricPlatformAPIClient {
    return new FabricPlatformAPIClient(workloadClient);
  }
}

/**
 * Usage Examples:
 * 
 * ```typescript
 * import { FabricPlatformAPIClient } from './controller';
 * import { WorkloadClientAPI } from '@ms-fabric/workload-client';
 * 
 * // Method 1: User Token Authentication (default)
 * // Initialize the workload client (this is typically done by the Fabric platform)
 * const workloadClient = new WorkloadClientAPI();
 * const fabricAPI = FabricPlatformAPIClient.create(workloadClient);
 * 
 * // Method 2: Service Principal Authentication
 * const fabricAPIWithServicePrincipal = FabricPlatformAPIClient.createWithServicePrincipal(
 *   'your-client-id',
 *   'your-client-secret',
 *   'your-tenant-id'
 * );
 * 
 * // Method 3: Custom Token Authentication
 * const fabricAPIWithCustomToken = FabricPlatformAPIClient.createWithCustomToken('your-access-token');
 * 
 * // Use individual clients (works the same regardless of authentication method)
 * const workspaces = await fabricAPI.workspaces.getAllWorkspaces();
 * const items = await fabricAPI.items.getAllItems(workspaceId);
 * const capacity = await fabricAPI.capacities.getCapacity(capacityId);
 * 
 * // Connection operations
 * const connections = await fabricAPI.connections.getAllConnections();
 * const connection = await fabricAPI.connections.getConnection(connectionId);
 * const adlsConnections = await fabricAPI.connections.getConnectionsByType('AdlsGen2');
 * const newConnection = await fabricAPI.connections.createConnection({
 *   displayName: 'My ADLS Connection',
 *   connectionType: 'AdlsGen2',
 *   description: 'Connection to Azure Data Lake Storage Gen2'
 * });
 * 
 * // External Data Shares operations
 * const providers = await fabricAPI.externalDataShares.getAllProviders(workspaceId);
 * const shares = await fabricAPI.externalDataShares.getAllExternalDataShares(workspaceId, itemId);
 * await fabricAPI.externalDataSharesRecipient.acceptInvitation(invitationToken, {
 *   shortcutCreation: { name: 'MyShortcut', path: '/Files' }
 * });
 * 
 * // Tags operations
 * const allTags = await fabricAPI.tags.getAllTags();
 * await fabricAPI.tags.applyTagsByName(workspaceId, itemId, ['Important', 'Production']);
 * const productionTags = await fabricAPI.tags.findTagsByName('production');
 * 
 * // OneLake Data Access Security operations
 * const dataAccessRoles = await fabricAPI.oneLakeDataAccessSecurity.getAllDataAccessRoles(workspaceId, itemId);
 * const readRole = fabricAPI.oneLakeDataAccessSecurity.createReadRole('TableReaders', ['/Tables/SalesData'], members);
 * await fabricAPI.oneLakeDataAccessSecurity.createOrUpdateDataAccessRoles(workspaceId, itemId, [readRole]);
 * 
 * // Spark operations
 * const sparkSettings = await fabricAPI.spark.getWorkspaceSparkSettings(workspaceId);
 * const customPools = await fabricAPI.spark.getAllCustomPools(workspaceId);
 * const livySessions = await fabricAPI.spark.getAllLivySessions(workspaceId);
 * 
 * // Spark Livy operations (lower-level API)
 * const batchResponse = await fabricAPI.sparkLivy.createBatch(workspaceId, lakehouseId, batchRequest);
 * const sessions = await fabricAPI.sparkLivy.listSessions(workspaceId, lakehouseId);
 * 
 * // Or use clients directly for more specific use cases
 * const sparkClient = new SparkClient(workloadClient);
 * const sparkLivyClient = new SparkLivyClient(workloadClient);
 * 
 * ```
 */
