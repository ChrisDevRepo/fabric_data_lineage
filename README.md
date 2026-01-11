# Fabric Data Lineage

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Fabric Extensibility Toolkit](https://img.shields.io/badge/Fabric-Extensibility%20Toolkit-purple)](https://github.com/microsoft/fabric-extensibility-toolkit)

Microsoft Fabric workload for visualizing object-level data lineage across Fabric Data Warehouses.

[Demo Video](https://www.youtube.com/watch?v=uZAk9PqHwJc) | [Documentation](docs/index.html) | [Quick Start](#quick-start)

![Data Lineage Graph](docs/images/data-lineage-gui.png)

## Features

- **Interactive Graph** - Pan, zoom, highlight. Nodes colored by schema, shaped by type.
- **Trace Mode** - Right-click to trace N levels up/downstream. Double-click for quick trace.
- **DDL Search** - Full-text search with syntax-highlighted viewer.
- **Multi-Database** - Switch between source DWHs. Single deployment.
- **Filtering** - Schema, type, data model classification, exclude patterns.
- **Export** - Save graph as image.

## Architecture

```
Source DWH → Copy Activity (Pipeline) → raw.* tables → Notebook → meta.* → GraphQL → React
```

### Security

- **Fabric User Auth** - Your Fabric identity, no separate credentials
- **Metadata Only** - Object names, schemas, DDL text. No table data read.
- **You Control Extraction** - You run DMV queries via your Pipeline
- **GraphQL Boundary** - Frontend reads only exposed GraphQL API

## Scope

**Included:** Fabric DWH object-level lineage (tables, views, SPs, functions), DDL parsing, multi-database

**Not included:** Column-level lineage

## Project Structure

```
setup/                             # Deployment assets
├── schema-ddl.sql                 # Database schema (DDL)
├── LineageParser.ipynb            # DDL parsing notebook
└── pipeline_datalineage.zip       # Copy pipeline template (import in Fabric)
src/Workload/                      # React frontend (Fabric SDK)
└── app/items/DataLineageItem/     # Main visualization
    └── ...
docs/                              # User documentation
scripts/                           # Build and deployment
```

## Quick Start

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for setup instructions.

## Development

```powershell
# Setup
cd scripts && pwsh ./Setup/Setup.ps1 -WorkloadName "Org.DataLineage"
cd ../src/Workload && npm install

# Run (Terminal 1: DevGateway first, Terminal 2: DevServer second)
cd scripts && pwsh ./Run/StartDevGateway.ps1
cd scripts && pwsh ./Run/StartDevServer.ps1
```

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICKSTART.md) | Try with demo mode |
| [Admin Setup](docs/ADMIN_SETUP.md) | Enable workload in tenant (admin only) |
| [Setup Guide](setup/README.md) | Deploy database, pipeline, GraphQL |
| [Features](docs/FEATURES.md) | Feature reference |
| [DMV Queries](docs/DMV_QUERIES.md) | Data extraction queries |

---

## Author

**Christian Wagner** - Data Architect & Engineer

[LinkedIn](https://at.linkedin.com/in/christian-wagner-11aa8614b) | [GitHub](https://github.com/ChrisDevRepo)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

> Built with the [Microsoft Fabric Extensibility Toolkit](https://github.com/microsoft/fabric-extensibility-toolkit)
