# Scripts

For developers who clone this repo and want to build/debug their own deployment.

## Local Development

```powershell
# Terminal 1 - DevGateway (must start first)
pwsh ./Run/StartDevGateway.ps1

# Terminal 2 - Frontend dev server
pwsh ./Run/StartDevServer.ps1
```

## Build Package

```powershell
pwsh ./Build/BuildManifestPackage.ps1
```

Creates `release/Org.DataLineage.x.x.x.nupkg` for upload to Fabric Admin Portal.

## Prerequisites

1. Copy `src/Workload/.env.template` to `.env` and configure
2. Download DevGateway from [Microsoft](https://learn.microsoft.com/en-us/fabric/workload-development-kit/quickstart-sample)
3. Enable Fabric Developer Mode in portal

## More Info

For full setup and deployment guidance, see the official toolkit:
https://github.com/microsoft/fabric-extensibility-toolkit
