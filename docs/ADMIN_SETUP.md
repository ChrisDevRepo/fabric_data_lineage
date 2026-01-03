# Admin Setup Guide

Deploy the Data Lineage workload to your Fabric tenant.

## Prerequisites

- Fabric capacity with admin permissions
- Azure subscription for HTTPS frontend hosting

## Workload Naming

- `Org.{WorkloadName}` — required for development, no registration needed
- `{Publisher}.{Workload}` — cross-tenant, requires [registration](https://aka.ms/fabric_workload_registration)

This workload uses `Org.DataLineage`.

## Step 1: Create Entra App

```powershell
pwsh scripts/Setup/CreateDevAADApp.ps1
```

Prompts for: Application name, Workload name (`Org.*`), Tenant ID.

Note the output: `Application Id`, `ApplicationIdUri`, `RedirectURI`.

For production, update the redirect URI in Azure Portal to `https://{your-domain}/close`.

## Step 2: Build Frontend

```powershell
cd src/Workload && npm install && npm run build:prod
```

## Step 3: Deploy Frontend

Deploy `build/Frontend/` to Azure Static Web Apps, App Service, or similar HTTPS hosting.

## Step 4: Configure Environment

Update `src/Workload/.env.prod` with values from Step 1:

```env
FRONTEND_APPID={application-id}
FRONTEND_URL=https://{your-domain}/
DEV_AAD_CONFIG_AUDIENCE={application-id-uri}
```

## Step 5: Build Manifest

```powershell
pwsh scripts/Build/BuildManifestPackage.ps1
```

Output: `build/Manifest/Org.DataLineage.{version}.nupkg`

## Step 6: Upload to Admin Portal

1. Fabric → Settings → Admin portal → Workloads → Upload workload
2. Select `.nupkg` from `build/Manifest/`
3. Select version → Add

## Verify

Users should see **Data Lineage** in **+ New** menu.

## Notes

- **Version format**: NuGet package uses SemVer (`1.0.0`), but `Product.json` schema version must be `"1.100"` format (not SemVer).
- **DevGateway vs Production**: If workload works locally but fails in production, re-upload the manifest to Admin Portal.

---

## Local Development (Optional)

Enable developer mode in Fabric settings (see Reference), then:

```powershell
# Terminal 1 (start first)
pwsh scripts/Run/StartDevGateway.ps1

# Terminal 2
pwsh scripts/Run/StartDevServer.ps1
```

## Reference

[Microsoft Fabric Extensibility Toolkit](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/)
