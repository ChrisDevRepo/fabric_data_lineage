# Admin Setup Guide

Deploy the Data Lineage workload to your Fabric tenant.

## Architecture

This workload uses **FERemote** hosting - two separate deployments:

| Component | Destination | Update When |
|-----------|-------------|-------------|
| **Frontend** (React) | Azure Static Web App | UI code changes |
| **Manifest** (.nupkg) | Fabric Admin Portal | Item config or version changes |

> **Reference:** [Host workload in Azure](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/tutorial-host-workload-in-azure)

## Prerequisites

- Fabric capacity with admin permissions
- Azure subscription (for Static Web App)
- Node.js 18+, PowerShell 7+

## Workload Naming

- `Org.{WorkloadName}` — development, no registration needed
- `{Publisher}.{Workload}` — cross-tenant, requires [registration](https://aka.ms/fabric_workload_registration)

This workload uses `Org.DataLineage`.

## Step 1: Create Entra App

Follow Microsoft docs or use the provided script:

> **Reference:** [Register Entra ID application](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/tutorial-setup-devenv#register-your-microsoft-entra-id-application)

```powershell
pwsh scripts/Setup/CreateDevAADApp.ps1
```

Note the output: `Application Id`, `ApplicationIdUri`, `RedirectURI`.

For production, update the redirect URI in Azure Portal to `https://{your-domain}/close`.

## Step 2: Configure Environment

Copy `src/Workload/.env.example` to `.env` and fill in values from Step 1.

## Step 3: Build Frontend

```powershell
cd src/Workload && npm install && npm run build:prod
```

## Step 4: Deploy Frontend

Create an Azure Static Web App and deploy:

> **Reference:** [Azure Static Web Apps CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-cli)

```powershell
# Copy SPA config (required for deep links!)
cp src/Workload/app/staticwebapp.config.json src/build/Frontend/

# Deploy using SWA CLI
swa deploy src/build/Frontend --deployment-token <your-token>
```

> **Important:** The `staticwebapp.config.json` enables SPA routing. Without it, direct URLs return 404.

## Step 5: Build Manifest

```powershell
pwsh scripts/Build/BuildManifestPackage.ps1
```

Output: `build/Manifest/Org.DataLineage.{version}.nupkg`

## Step 6: Upload to Admin Portal

> **Reference:** [Upload workload](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/tutorial-upload-manifest)

1. Fabric → Settings → Admin portal → Workloads → Upload workload
2. Select `.nupkg` from `build/Manifest/`
3. Select version → Add

## Verify

1. Open your Static Web App URL - should load without errors
2. In Fabric: **+ New** > **Data Lineage** should appear

## Next Steps

After workload deployment, set up the data pipeline: [setup/README.md](../setup/README.md)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on deep links | Ensure `staticwebapp.config.json` is in build output |
| Workload not visible | Upload manifest to Admin Portal |
| Changes not showing | Clear browser cache (Ctrl+Shift+R) |
| Version format | NuGet uses SemVer (`1.0.0`), Product.json uses `"1.100"` |

---

## Local Development (Optional)

Enable developer mode in Fabric settings, then:

```powershell
# Terminal 1 (start first)
pwsh scripts/Run/StartDevGateway.ps1

# Terminal 2
pwsh scripts/Run/StartDevServer.ps1
```

## Reference

- [Fabric Extensibility Toolkit](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/)
- [Workload Development Overview](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/concept-workload-overview)
- [Publishing Requirements](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-requirements-overview)
