# Setup Instructions

## Prerequisites

- Fabric workspace (Contributor+ permissions)
- Fabric Data Warehouse to analyze
- Workload enabled in your tenant (see [Quick Start](../docs/QUICKSTART.md))

---

## User Setup

### 1. Create Database

1. **+ New** > **SQL database** > Name: `LineageDB`
2. Open **SQL Editor**
3. Paste contents of `schema-ddl.sql` and click **Run**
4. Verify objects created:

```
LineageDB
├── raw (schema)
│   ├── objects          (table)
│   ├── definitions      (table)
│   ├── dependencies     (table)
│   └── table_columns    (table)
└── meta (schema)
    ├── sources              (table)
    ├── external_objects     (table)
    ├── lineage_edges        (table)
    ├── parsed_edges         (table)
    ├── parser_log           (table)
    ├── vw_sources           (view)
    ├── vw_objects           (view)
    ├── vw_definitions       (view)
    ├── vw_lineage_edges     (view)
    ├── vw_parser_log_steps  (view)
    └── sp_* (10 procedures)
```

### 2. Create GraphQL API

1. Open `LineageDB` in workspace
2. Select **New API for GraphQL**
3. Enter name `LineageGraphQL` and click **Create**
4. Click **Get data** and select these objects:
   - `meta.vw_sources`
   - `meta.vw_objects`
   - `meta.vw_definitions`
   - `meta.vw_lineage_edges`
   - `meta.sp_set_active_source`
   - `meta.sp_search_ddl`
5. Click **Load**
6. Copy the **endpoint URL** from the ribbon

> **Note - Workspace Access:** Users must have at least **Viewer** access to this workspace to query the GraphQL API. For automated pipelines or CLI debugging using a Service Principal (SPN), the SPN must have **Contributor** access. Go to **Workspace Settings** > **Manage access** to configure permissions.

### 3. Import Notebook

1. **+ New** > **Import** > Select `LineageParser.ipynb`
2. Open notebook and locate the CONFIG cell (cell 2):
   ```python
   CONFIG = {"db_name": "db_datalineage"}
   ```
3. Change the database name to match your SQL Database name **exactly** (case-sensitive)

> **Important:** The notebook must be in the **same workspace** as the SQL Database. If you get `Login timeout expired`, verify the database name matches exactly.

### 4. Import Pipeline

Import the pre-built pipeline template that copies metadata from your warehouse.

1. **+ New** > **Data Pipeline** > Name: `CopyLineageData`
2. In the pipeline editor, click **Import** on the **Home** tab
3. Select `pipeline_datalineage.zip` from this folder
4. In the template dialog, configure the connections:
   - **Warehouse**: Select your source Data Warehouse from OneLake catalog
   - **SQL Database**: Select your `LineageDB` and create a new connection (e.g., `conn_LineageDB`)
5. Click **Use this template**
6. Select the **Notebook** activity and configure:
   - **Workspace**: Select your workspace (e.g., `DataLineage`)
   - **Notebook**: Select `LineageParser`
7. Click **Save**, then **Run** to verify the pipeline executes successfully

> **Note:** Data is ingested to the `raw` schema and prepared in `meta` for visualization.

### 5. Create Data Lineage Item

1. **+ New** > **Data Lineage** (under custom workloads)
2. Open **Settings** > **Connection** tab
3. Paste the GraphQL endpoint URL (copied in Step 2.6)
4. Click **Test Connection** > **Save**
5. Click **Refresh** in toolbar

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **401 Unauthorized** | User/SPN lacks workspace access | Add user/SPN to workspace with Viewer+ role |
| **429 Too Many Requests** | API rate limited | Wait for block to expire (shown in error), then retry |
| **500 Internal Server Error** | Fabric SQL cold start | Retry after 30-60 seconds (auto-handled by app) |
| **Empty data** | Pipeline not run or no active source | Run pipeline, check `meta.sources` has `is_active=1` |
| **Login timeout expired** | Notebook can't connect to DB | Check `CONFIG["db_name"]` matches exactly, notebook in same workspace |

---

## Optional

- **Schedule Pipeline**: Pipeline > Schedule for regular refresh
- **Multiple Warehouses**: Adjust pipeline to add copy activities for each source warehouse
- **Custom Parsing**: Edit `LineageParser.ipynb` to adjust DDL parsing rules
