// Main API Client Infrastructure
export { FabricPlatformClient } from './FabricPlatformClient';
export { FabricPlatformAPIClient } from './FabricPlatformAPIClient';
export { FabricAuthenticationService } from './FabricAuthenticationService';
export * from './FabricPlatformTypes';

// Note: All specific API client controllers have been removed
// Data Lineage app only uses FabricAuthenticationService for GraphQL authentication

// Re-export WorkloadClientAPI for convenience
export { WorkloadClientAPI } from '@ms-fabric/workload-client';
