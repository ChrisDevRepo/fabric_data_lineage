# Fabric Data Lineage

Object Dependency Visualization for Microsoft Fabric Data Warehouses.

![Product Page](images/Product-Page.png)

---

## Overview

Fabric workload providing interactive graph visualization for analyzing object dependencies in Fabric Data Warehouses. Built with the Fabric Extensibility SDK, integrates natively with the Fabric portal.

**Problem:** Large DWHs accumulate complexity. Understanding impact of changes requires manually reading SQL or maintaining documentation that becomes outdated.

**Solution:** Interactive graph mapping dependencies from database metadata. Click any object to see what it references and what references it. Trace data flow. Search DDL.

---

## Key Capabilities

| Feature | Description |
|---------|-------------|
| **Interactive Graph** | Pan, zoom, highlight. Nodes colored by schema, shaped by type. |
| **Trace Mode** | Right-click to trace N levels up/downstream. Double-click for quick trace. |
| **DDL Search** | Full-text search with syntax-highlighted viewer. |
| **Multi-Database** | Switch between source DWHs. Single deployment. |
| **Filtering** | Schema, type, data model classification, exclude patterns. |
| **Export** | Save graph as image. |

---

## Architecture

### Security

- **Fabric User Auth** - Your Fabric identity, no separate credentials
- **Metadata Only** - Object names, schemas, DDL text. **No table data read.**
- **You Control Extraction** - You run DMV queries via your Pipeline
- **GraphQL Boundary** - Frontend reads only exposed GraphQL API

### Data Flow

```
Source DWH (sys.objects, sys.sql_modules, sys.sql_expression_dependencies)
    ↓  Copy Activity (Pipeline)
Fabric SQL Database (raw.* tables)
    ↓  Notebook (parse DDL)
GraphQL API (meta.* views)
    ↓
React Frontend (ReactFlow)
```

---

## Scope

### Included

- Fabric Data Warehouse object-level lineage (tables, views, SPs, functions)
- Dependencies from `sys.sql_expression_dependencies` + DDL parsing
- Cross-warehouse lineage (3-part naming to other warehouses in same workspace)
- External file sources (OPENROWSET, COPY INTO from OneLake/Blob/ADLS)
- Multi-database switching, DDL search, data model classification, export

### Not Included

- Column-level lineage (object-level only)
- Lakehouse delta table metadata (data warehouse only)

---

## Technology

| Component | Technology |
|-----------|------------|
| Frontend | React 18, ReactFlow, Fluent UI v9 |
| Backend | Fabric SQL Database, GraphQL API |
| Parsing | Python Notebook |
| SDK | Microsoft Fabric Extensibility Toolkit |

---

## Getting Started

- [QUICKSTART.md](QUICKSTART.md) - Setup instructions
- [FEATURES.md](FEATURES.md) - Feature documentation

---

*MIT License. Built by Christian Wagner.*
