import { AccessToken, WorkloadClientAPI } from "@ms-fabric/workload-client";

/**
 * FabricAuthenticationService - Token acquisition for Fabric Workload SDK
 *
 * This service wraps the WorkloadClient's acquireFrontendAccessToken() method
 * to acquire OAuth tokens for various Fabric APIs.
 *
 * IMPORTANT: For Fabric iframe SDK (FERemote hosting), only user token authentication
 * is supported. Service principal auth is NOT available in the iframe context.
 *
 * Common scopes:
 * - Power BI / GraphQL API: 'https://analysis.windows.net/powerbi/api/.default'
 * - Fabric Platform API: 'https://api.fabric.microsoft.com/.default'
 *
 * See FabricPlatformScopes.ts for all available scopes.
 */
export class FabricAuthenticationService {
  private workloadClient: WorkloadClientAPI;

  constructor(workloadClient: WorkloadClientAPI) {
    this.workloadClient = workloadClient;
  }

  /**
   * Acquire an access token for the specified scope
   *
   * @param scopes Space-separated OAuth scopes (e.g., 'https://analysis.windows.net/powerbi/api/.default')
   * @returns Promise<AccessToken> with the bearer token
   * @throws Error if token acquisition fails (check Entra app configuration)
   *
   * Common errors:
   * - Error 3 (UnknownError): Usually missing redirect URI in Entra app
   * - Error 4 (ScopesError): Invalid or unconfigured scope
   *
   * @example
   * ```typescript
   * const authService = new FabricAuthenticationService(workloadClient);
   * const token = await authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);
   * // Use token.token as Bearer token in Authorization header
   * ```
   */
  async acquireAccessToken(scopes: string): Promise<AccessToken> {
    // Convert space-separated scopes string to array
    const scopeArray = scopes?.length ? scopes.split(' ') : [];

    try {
      const result = await this.workloadClient.auth.acquireFrontendAccessToken({
        scopes: scopeArray
      });
      return result;
    } catch (error: unknown) {
      // Log error for debugging but don't expose internal details
      console.error('[FabricAuthService] Token acquisition failed:', error);
      throw error;
    }
  }
}
