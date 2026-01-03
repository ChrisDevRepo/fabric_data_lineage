# Setup Instructions

## Prerequisites

- Fabric workspace (Contributor+ permissions)
- Fabric Data Warehouse to analyze
- Workload enabled in your tenant (see [Admin Setup](../docs/ADMIN_SETUP.md))

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
2. Select **New** > **GraphQL API**
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

### 3. Create Connections

Before importing the pipeline, create the required connections:

1. Click the **Settings** gear icon (top right) > **Manage connections and gateways**
2. Select **Connections** tab > **+ New**
3. Create **Fabric SQL Database** connection → select `LineageDB`
4. Create **Data Warehouse** connection → select your source warehouse(s)

### 4. Import Notebook

1. **+ New** > **Import** > Select `LineageParser.ipynb`
2. Open notebook and locate the CONFIG cell (cell 2):
   ```python
   CONFIG = {"db_name": "metalineage"}
   ```
3. Change `"metalineage"` to your database name (e.g., `"LineageDB"`)

### 5. Import Pipeline

Import the pre-built pipeline template that copies metadata from your warehouse.

1. **+ New** > **Data Pipeline** > Name: `CopyLineageData`
2. In the pipeline editor, click **Import** on the **Home** tab
3. Select `pipeline_datalineage.zip` from this folder
4. Map your connections:
   - **Source**: Select your Data Warehouse connection
   - **Destination**: Select your LineageDB connection
5. Click **Use this template**
6. Update the **Notebook activity**:
   - Click the Notebook activity
   - Select your `LineageParser` notebook
7. Click **Save**

### 6. Run Pipeline

1. Click **Run**
2. Wait for completion
3. Verify data loaded:
   - Open `LineageDB` in workspace
   - Expand **Views** > **meta** > **vw_objects**
   - Click the view to preview data - should show your warehouse objects

### 7. Create Data Lineage Item

1. **+ New** > **Data Lineage** (under custom workloads)
2. Open **Settings** > **Connection** tab
3. Paste the GraphQL endpoint URL (copied in Step 2.6)
4. Click **Test Connection** > **Save**
5. Click **Refresh** in toolbar

---

## Optional

- **Schedule Pipeline**: Pipeline > Schedule for regular refresh
- **Multiple Warehouses**: Adjust pipeline to add copy activities for each source warehouse
- **Custom Parsing**: Edit `LineageParser.ipynb` to adjust DDL parsing rules
