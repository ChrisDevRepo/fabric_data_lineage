# Fabric Data Lineage

> **Visualize object-level dependencies** inside your Fabric Data Warehouse — tables, views, stored procedures, and functions.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Fabric Extensibility Toolkit](https://img.shields.io/badge/Built_with-Fabric_Extensibility_Toolkit-742774)](https://github.com/microsoft/fabric-extensibility-toolkit)

<p align="center">
  <a href="https://youtu.be/hE5UCSByBo0">Watch Demo</a> •
  <a href="docs/QUICKSTART.md">Quick Start</a> •
  <a href="docs/">Documentation</a>
</p>

![Interactive lineage graph showing object dependencies](docs/images/data-lineage-gui.png)

---

## Why This Tool

Fabric provides **item-level** lineage: Pipeline → Warehouse → Report.

This tool goes deeper — inside your warehouse. Visualize how tables, views, and stored procedures connect. Trace dependencies across schemas, search DDL code, understand impact before you deploy.

---

## Features

| | Feature | Description |
|---|---------|-------------|
| **Graph** | Interactive visualization | Pan, zoom, click. Nodes colored by schema, shaped by object type. |
| **Trace** | Upstream/downstream | Right-click any object → trace N levels up or down. See what feeds it, what depends on it. |
| **Search** | Full-text DDL search | Find every SP that references `dbo.Orders`. Syntax-highlighted viewer. |
| **Filter** | Smart filtering | By schema, object type, data model layer. |
| **Focus** | Focus Schema | Star a schema to show only its direct neighbors. |
| **Multi-DB** | Multiple warehouses | Switch sources with a dropdown. Track cross-database references. |
| **Export** | Save as image | Export to PNG or JPEG with optional legend and high resolution. |

---

## Quick Start

**Try it in 5 minutes** — Demo mode requires no database setup.

| Step | Action |
|------|--------|
| **1** | Admin enables workloads + uploads [package](release/) ([details](docs/QUICKSTART.md#1-admin-setup)) |
| **2** | Create **+ New → Data Lineage** item, click **Refresh** |
| **3** | Explore the demo graph. [Connect your warehouse](setup/) when ready. |

---

## How It Works

```
Your DWH → Copy Pipeline → Parsing Notebook → GraphQL API → React Frontend
           (metadata only)   (DDL analysis)    (secure)      (this app)
```

**Security model:**
- Your Fabric identity — no separate credentials
- Metadata only — object names, schemas, DDL. Never reads table data.
- Stays in your tenant — you control the pipeline and storage

---

## Project Structure

```
setup/                  # Database schema, parser notebook, pipeline template
src/Workload/           # React frontend (Fabric Extensibility SDK)
docs/                   # User documentation
scripts/                # Build and run scripts
release/                # Deployable package (.nupkg)
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Quick Start](docs/QUICKSTART.md) | Try demo mode, admin setup, connect your data |
| [Setup Guide](setup/README.md) | Deploy database, pipeline, GraphQL endpoint |
| [Features](docs/FEATURES.md) | Complete feature reference |

---

## Author

**Christian Wagner** — Data Architect & Engineer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2)](https://at.linkedin.com/in/christian-wagner-11aa8614b)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717)](https://github.com/ChrisDevRepo)

---

<p align="center">
  <sub>MIT License • Built with the <a href="https://github.com/microsoft/fabric-extensibility-toolkit">Microsoft Fabric Extensibility Toolkit</a> and <a href="https://github.com/anthropics/claude-code">Claude Code</a></sub>
</p>
