# DMV Extraction Queries

The pipeline extracts metadata from your source Data Warehouse using these SQL queries against system DMVs (Dynamic Management Views). This document explains what data is extracted and why.

## Data Flow

```
Source DWH (sys.* DMVs) → Copy Pipeline → raw.* tables → Parser → meta.* tables → GraphQL → Frontend
```

## Unique Identifier

Each warehouse is identified by a composite key:
- `@@SERVERNAME` - Shared per workspace endpoint
- `DB_NAME()` - Unique per warehouse within workspace

Together they form the unique identifier for multi-warehouse support.

---

## Query 1: Objects

**Target:** `raw.objects`

Extracts all database objects (Tables, Views, Stored Procedures, Functions).

```sql
SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name,
    o.object_id,
    OBJECT_SCHEMA_NAME(o.object_id) AS schema_name,
    o.name AS object_name,
    o.type AS object_type_code,
    o.create_date,
    o.modify_date
FROM sys.objects o
WHERE o.type IN ('U', 'V', 'P', 'FN', 'IF', 'TF')
  AND OBJECT_SCHEMA_NAME(o.object_id) NOT IN (
      'sys', 'INFORMATION_SCHEMA', 'tempdb', 'master', 'msdb', 'model'
  )
  AND o.is_ms_shipped = 0;
```

| Type Code | Description |
|-----------|-------------|
| U | User Table |
| V | View |
| P | Stored Procedure |
| FN | Scalar Function |
| IF | Inline Table-Valued Function |
| TF | Table-Valued Function |

---

## Query 2: Definitions

**Target:** `raw.definitions`

Extracts DDL (SQL code) for Views, Stored Procedures, and Functions.

```sql
SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name,
    o.object_id,
    m.definition
FROM sys.sql_modules m
INNER JOIN sys.objects o ON m.object_id = o.object_id
WHERE o.type IN ('V', 'P', 'FN', 'IF', 'TF')
  AND OBJECT_SCHEMA_NAME(o.object_id) NOT IN (
      'sys', 'INFORMATION_SCHEMA', 'tempdb', 'master', 'msdb', 'model'
  )
  AND o.is_ms_shipped = 0
  AND m.definition IS NOT NULL;
```

> **Note:** Tables don't have definitions in `sys.sql_modules`. Their DDL is generated from column metadata (Query 4).

---

## Query 3: Dependencies

**Target:** `raw.dependencies`

Extracts object dependencies from `sys.sql_expression_dependencies`.

```sql
SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name,
    d.referencing_id AS referencing_object_id,
    d.referenced_id AS referenced_object_id,
    OBJECT_SCHEMA_NAME(d.referencing_id) AS referencing_schema_name,
    OBJECT_NAME(d.referencing_id) AS referencing_entity_name,
    d.referenced_database_name,
    d.referenced_schema_name,
    d.referenced_entity_name,
    o1.type_desc AS referencing_type,
    o2.type_desc AS referenced_type
FROM sys.sql_expression_dependencies d
INNER JOIN sys.objects o1 ON d.referencing_id = o1.object_id
LEFT JOIN sys.objects o2 ON d.referenced_id = o2.object_id
WHERE d.referencing_id IS NOT NULL
  AND o1.is_ms_shipped = 0
  AND OBJECT_SCHEMA_NAME(d.referencing_id) NOT IN (
      'sys', 'INFORMATION_SCHEMA', 'tempdb', 'master', 'msdb', 'model'
  );
```

> **Cross-Warehouse References:** When `referenced_database_name IS NOT NULL`, the dependency points to another warehouse (3-part name like `OtherDB.schema.table`).

---

## Query 4: Table Columns

**Target:** `raw.table_columns`

Extracts column metadata for generating CREATE TABLE DDL.

```sql
SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name,
    c.object_id,
    c.column_id,
    c.name AS column_name,
    TYPE_NAME(c.user_type_id) AS data_type,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    c.is_identity,
    OBJECT_SCHEMA_NAME(c.object_id) AS schema_name,
    OBJECT_NAME(c.object_id) AS table_name
FROM sys.columns c
INNER JOIN sys.objects o ON c.object_id = o.object_id
WHERE o.type = 'U'
  AND OBJECT_SCHEMA_NAME(o.object_id) NOT IN (
      'sys', 'INFORMATION_SCHEMA', 'tempdb', 'master', 'msdb', 'model'
  )
  AND o.is_ms_shipped = 0;
```

---

## Customization

If you need to modify which objects are extracted, you can:
1. Fork the repository
2. Edit the Copy Activity queries in the pipeline
3. Redeploy using the Deploy notebook

Common customizations:
- Add/remove schema filters
- Include additional object types
- Filter by object name patterns
