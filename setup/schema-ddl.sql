-- ============================================================================
-- DATA LINEAGE - Database Schema (Idempotent - safe to re-run)
-- ============================================================================
-- Flow: Source DWH → Copy Pipeline → raw.* → Parser Notebook → meta.* → GraphQL → Frontend
-- ============================================================================

-- Create schemas
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'raw') EXEC('CREATE SCHEMA raw');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'meta') EXEC('CREATE SCHEMA meta');
GO

-- Drop all tables (order matters for dependencies)
DROP TABLE IF EXISTS meta.parser_log, meta.parsed_edges, meta.lineage_edges, meta.external_objects, meta.sources;
DROP TABLE IF EXISTS raw.table_columns, raw.dependencies, raw.definitions, raw.objects;
GO

-- ============================================================================
-- RAW SCHEMA: Ingestion layer (populated by Copy Pipeline from source DWH)
-- ============================================================================

CREATE TABLE raw.objects (
    server_name NVARCHAR(128), database_name NVARCHAR(128), object_id INT,
    schema_name NVARCHAR(128), object_name NVARCHAR(128), object_type_code NVARCHAR(2),
    create_date DATETIME2, modify_date DATETIME2
);

CREATE TABLE raw.definitions (
    server_name NVARCHAR(128), database_name NVARCHAR(128), object_id INT,
    definition NVARCHAR(MAX)
);

CREATE TABLE raw.dependencies (
    server_name NVARCHAR(128), database_name NVARCHAR(128),
    referencing_object_id INT, referenced_object_id INT, referenced_database_name NVARCHAR(128),
    referencing_schema_name NVARCHAR(128), referencing_entity_name NVARCHAR(128),
    referenced_schema_name NVARCHAR(128), referenced_entity_name NVARCHAR(128),
    referencing_type NVARCHAR(60), referenced_type NVARCHAR(60)
);

CREATE TABLE raw.table_columns (
    server_name NVARCHAR(128), database_name NVARCHAR(128), object_id INT,
    column_id INT, column_name NVARCHAR(128), data_type NVARCHAR(128),
    max_length SMALLINT, precision TINYINT, scale TINYINT,
    is_nullable BIT, is_identity BIT, schema_name NVARCHAR(128), table_name NVARCHAR(128)
);

-- ============================================================================
-- META SCHEMA: Core layer (populated by Parser, exposed via GraphQL)
-- ============================================================================

CREATE TABLE meta.sources (
    source_id INT NOT NULL IDENTITY(1,1), server_name NVARCHAR(256) NOT NULL,
    database_name NVARCHAR(128) NOT NULL, description NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 0, created_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE meta.external_objects (
    object_id BIGINT NOT NULL IDENTITY(-1,-1), source_id INT NOT NULL,
    ref_type TINYINT NOT NULL, ref_name NVARCHAR(500) NOT NULL, display_name NVARCHAR(256) NOT NULL
);

CREATE TABLE meta.lineage_edges (
    source_id INT NOT NULL, source_object_id BIGINT NOT NULL, target_object_id BIGINT NOT NULL,
    source_type TINYINT NOT NULL, target_type TINYINT NOT NULL
);

CREATE TABLE meta.parsed_edges (
    source_id INT NOT NULL, source_object_id BIGINT NOT NULL, target_object_id BIGINT NOT NULL,
    source_type TINYINT NOT NULL, target_type TINYINT NOT NULL
);

CREATE TABLE meta.parser_log (
    log_id INT NOT NULL IDENTITY(1,1), run_id UNIQUEIDENTIFIER NOT NULL,
    run_started_at DATETIME2 NOT NULL, db_name NVARCHAR(128) NOT NULL, server_name NVARCHAR(256) NOT NULL,
    sp_object_id BIGINT NOT NULL, sp_full_name NVARCHAR(257) NOT NULL,
    raw_ddl NVARCHAR(MAX), cleaned_ddl NVARCHAR(MAX), parsing_steps NVARCHAR(MAX),
    edge_count INT NOT NULL, status NVARCHAR(50) NOT NULL, error_message NVARCHAR(MAX)
);
GO

-- ============================================================================
-- VIEWS: GraphQL API layer
-- ============================================================================

-- Source dropdown list
CREATE OR ALTER VIEW meta.vw_sources AS
SELECT source_id, database_name, description, is_active, created_at
FROM meta.sources;
GO

-- DDL for code viewer (raw definitions + generated CREATE TABLE)
CREATE OR ALTER VIEW meta.vw_definitions AS
SELECT s.source_id, d.object_id, d.definition
FROM raw.definitions d
INNER JOIN meta.sources s ON d.server_name = s.server_name AND d.database_name = s.database_name
WHERE s.is_active = 1
UNION ALL
SELECT
    s.source_id,
    tc.object_id,
    'CREATE TABLE [' + o.schema_name + '].[' + o.object_name + '] (' + CHAR(13) + CHAR(10) +
    STRING_AGG(
        '    [' + tc.column_name + '] ' +
        UPPER(tc.data_type) +
        CASE
            WHEN tc.data_type IN ('varchar', 'nvarchar', 'char', 'nchar', 'varbinary', 'binary') THEN
                CASE
                    WHEN tc.max_length = -1 THEN '(MAX)'
                    WHEN tc.data_type IN ('nvarchar', 'nchar') THEN '(' + CAST(tc.max_length / 2 AS NVARCHAR(10)) + ')'
                    ELSE '(' + CAST(tc.max_length AS NVARCHAR(10)) + ')'
                END
            WHEN tc.data_type IN ('decimal', 'numeric') THEN
                '(' + CAST(tc.precision AS NVARCHAR(10)) + ',' + CAST(tc.scale AS NVARCHAR(10)) + ')'
            WHEN tc.data_type IN ('datetime2', 'time', 'datetimeoffset') AND tc.scale <> 7 THEN
                '(' + CAST(tc.scale AS NVARCHAR(10)) + ')'
            ELSE ''
        END +
        CASE WHEN tc.is_identity = 1 THEN ' IDENTITY(1,1)' ELSE '' END +
        CASE WHEN tc.is_nullable = 1 THEN ' NULL' ELSE ' NOT NULL' END,
        ',' + CHAR(13) + CHAR(10)
    ) WITHIN GROUP (ORDER BY tc.column_id) +
    CHAR(13) + CHAR(10) + ');' AS definition
FROM raw.table_columns tc
INNER JOIN raw.objects o ON tc.server_name = o.server_name AND tc.database_name = o.database_name AND tc.object_id = o.object_id
INNER JOIN meta.sources s ON tc.server_name = s.server_name AND tc.database_name = s.database_name
WHERE o.object_type_code = 'U' AND s.is_active = 1
GROUP BY s.source_id, tc.object_id, o.schema_name, o.object_name;
GO

-- Edges with bidirectional flag for graph rendering
CREATE OR ALTER VIEW meta.vw_lineage_edges AS
SELECT
    e.source_id,
    e.source_object_id,
    e.target_object_id,
    e.source_type,
    e.target_type,
    CAST(CASE WHEN EXISTS (
        SELECT 1 FROM meta.lineage_edges e2
        WHERE e2.source_id = e.source_id
          AND e2.source_object_id = e.target_object_id
          AND e2.target_object_id = e.source_object_id
    ) THEN 1 ELSE 0 END AS BIT) AS is_bidirectional
FROM meta.lineage_edges e
INNER JOIN meta.sources s ON e.source_id = s.source_id
WHERE s.is_active = 1;
GO

-- Objects for graph nodes (local + external with edges)
CREATE OR ALTER VIEW meta.vw_objects AS
SELECT
    s.source_id,
    o.object_id,
    o.schema_name,
    o.object_name,
    CASE
        WHEN o.object_type_code = 'U' THEN 'Table'
        WHEN o.object_type_code = 'V' THEN 'View'
        WHEN o.object_type_code = 'P' THEN 'Stored Procedure'
        WHEN o.object_type_code IN ('FN', 'IF', 'TF') THEN 'Function'
        ELSE o.object_type_code
    END AS object_type,
    CAST(0 AS TINYINT) AS ref_type,
    CAST(NULL AS NVARCHAR(500)) AS ref_name
FROM raw.objects o
INNER JOIN meta.sources s ON o.server_name = s.server_name AND o.database_name = s.database_name
WHERE s.is_active = 1
UNION ALL
SELECT
    e.source_id,
    e.object_id,
    CAST('' AS NVARCHAR(128)) AS schema_name,
    e.display_name AS object_name,
    'External' AS object_type,
    e.ref_type,
    e.ref_name
FROM meta.external_objects e
INNER JOIN meta.sources s ON e.source_id = s.source_id
WHERE s.is_active = 1
  AND EXISTS (
      SELECT 1 FROM meta.lineage_edges le
      WHERE le.source_id = e.source_id
        AND (le.source_object_id = e.object_id OR le.target_object_id = e.object_id)
  );
GO

-- Parser log flattened for debugging
CREATE OR ALTER VIEW meta.vw_parser_log_steps AS
SELECT
    pl.log_id,
    pl.run_id,
    pl.run_started_at,
    pl.db_name,
    pl.server_name,
    pl.sp_object_id,
    pl.sp_full_name,
    pl.raw_ddl,
    pl.cleaned_ddl,
    pl.edge_count,
    pl.status,
    step.step_order,
    step.rule_name,
    step.rule_target,
    step.pattern,
    step.inputs_found,
    step.outputs_found,
    step.match_context
FROM meta.parser_log pl
OUTER APPLY OPENJSON(pl.parsing_steps)
WITH (
    step_order INT '$.order',
    rule_name NVARCHAR(100) '$.rule_name',
    rule_target NVARCHAR(50) '$.rule_target',
    pattern NVARCHAR(500) '$.pattern',
    inputs_found NVARCHAR(MAX) '$.inputs_found' AS JSON,
    outputs_found NVARCHAR(MAX) '$.outputs_found' AS JSON,
    match_context NVARCHAR(MAX) '$.match_context' AS JSON
) AS step;
GO

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Reset all meta tables for fresh parse run
CREATE OR ALTER PROCEDURE meta.sp_clear_parser_cache
AS
BEGIN
    SET NOCOUNT ON;
    TRUNCATE TABLE meta.lineage_edges;
    TRUNCATE TABLE meta.parsed_edges;
    TRUNCATE TABLE meta.external_objects;
    DELETE FROM meta.sources;
    DBCC CHECKIDENT ('meta.sources', RESEED, 0);
END;
GO

-- Merge DMV + parser edges into final lineage_edges
CREATE OR ALTER PROCEDURE meta.sp_compute_lineage
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE meta.lineage_edges;

    -- Cross-DB externals from DMV (Views/Functions)
    INSERT INTO meta.external_objects (source_id, ref_type, ref_name, display_name)
    SELECT DISTINCT
        s.source_id,
        CAST(2 AS TINYINT) AS ref_type,
        d.referenced_database_name + '.' + d.referenced_schema_name + '.' + d.referenced_entity_name,
        d.referenced_entity_name
    FROM raw.dependencies d
    INNER JOIN raw.objects o ON d.server_name = o.server_name AND d.database_name = o.database_name
        AND d.referencing_object_id = o.object_id
    INNER JOIN meta.sources s ON d.server_name = s.server_name AND d.database_name = s.database_name
    WHERE d.referenced_database_name IS NOT NULL
      AND o.object_type_code IN ('V', 'FN', 'IF', 'TF')
      AND NOT EXISTS (
          SELECT 1 FROM meta.external_objects e
          WHERE e.source_id = s.source_id
            AND e.ref_name = d.referenced_database_name + '.' + d.referenced_schema_name + '.' + d.referenced_entity_name
      );

    -- Cross-DB edges from DMV
    INSERT INTO meta.lineage_edges (source_id, source_object_id, target_object_id, source_type, target_type)
    SELECT DISTINCT
        s.source_id,
        e.object_id AS source_object_id,
        d.referencing_object_id AS target_object_id,
        CAST(2 AS TINYINT) AS source_type,
        CAST(0 AS TINYINT) AS target_type
    FROM raw.dependencies d
    INNER JOIN raw.objects o ON d.server_name = o.server_name AND d.database_name = o.database_name
        AND d.referencing_object_id = o.object_id
    INNER JOIN meta.sources s ON d.server_name = s.server_name AND d.database_name = s.database_name
    INNER JOIN meta.external_objects e
        ON e.source_id = s.source_id
        AND e.ref_name = d.referenced_database_name + '.' + d.referenced_schema_name + '.' + d.referenced_entity_name
    WHERE d.referenced_database_name IS NOT NULL
      AND o.object_type_code IN ('V', 'FN', 'IF', 'TF');

    -- Local edges from DMV (Views/Functions)
    INSERT INTO meta.lineage_edges (source_id, source_object_id, target_object_id, source_type, target_type)
    SELECT DISTINCT
        s.source_id,
        d.referenced_object_id AS source_object_id,
        d.referencing_object_id AS target_object_id,
        CAST(0 AS TINYINT) AS source_type,
        CAST(0 AS TINYINT) AS target_type
    FROM raw.dependencies d
    INNER JOIN raw.objects o ON d.server_name = o.server_name AND d.database_name = o.database_name
        AND d.referencing_object_id = o.object_id
    INNER JOIN meta.sources s ON d.server_name = s.server_name AND d.database_name = s.database_name
    WHERE d.referenced_object_id IS NOT NULL
      AND o.object_type_code IN ('V', 'FN', 'IF', 'TF')
      AND d.referenced_object_id <> d.referencing_object_id
      AND NOT EXISTS (
          SELECT 1 FROM meta.lineage_edges le
          WHERE le.source_id = s.source_id
            AND le.source_object_id = d.referenced_object_id
            AND le.target_object_id = d.referencing_object_id
      );

    -- Parser edges (SPs + external refs)
    INSERT INTO meta.lineage_edges (source_id, source_object_id, target_object_id, source_type, target_type)
    SELECT DISTINCT p.source_id, p.source_object_id, p.target_object_id, p.source_type, p.target_type
    FROM meta.parsed_edges p
    WHERE p.source_object_id <> p.target_object_id
      AND NOT EXISTS (
          SELECT 1 FROM meta.lineage_edges le
          WHERE le.source_id = p.source_id
            AND le.source_object_id = p.source_object_id
            AND le.target_object_id = p.target_object_id
      );
END;
GO

-- Get object catalog for parser validation (returns source_id for parser)
CREATE OR ALTER PROCEDURE meta.sp_get_catalog
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.source_id, o.object_id, LOWER(o.schema_name + '.' + o.object_name) AS full_name,
        CASE
            WHEN o.object_type_code = 'U' THEN 'Table'
            WHEN o.object_type_code = 'V' THEN 'View'
            WHEN o.object_type_code = 'P' THEN 'Stored Procedure'
            WHEN o.object_type_code IN ('FN', 'IF', 'TF') THEN 'Function'
            ELSE o.object_type_code
        END AS object_type
    FROM raw.objects o
    INNER JOIN meta.sources s ON o.server_name = s.server_name AND o.database_name = s.database_name;
END;
GO

-- Get SP definitions for DDL parsing
CREATE OR ALTER PROCEDURE meta.sp_get_sp_definitions
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.source_id, o.object_id, LOWER(o.schema_name + '.' + o.object_name) AS full_name, d.definition
    FROM raw.objects o
    INNER JOIN raw.definitions d ON o.server_name = d.server_name AND o.database_name = d.database_name AND o.object_id = d.object_id
    INNER JOIN meta.sources s ON o.server_name = s.server_name AND o.database_name = s.database_name
    WHERE o.object_type_code = 'P'
      AND d.definition IS NOT NULL AND d.definition <> '';
END;
GO

-- Get View/Function definitions for external ref parsing
CREATE OR ALTER PROCEDURE meta.sp_get_view_definitions
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.source_id, o.object_id, LOWER(o.schema_name + '.' + o.object_name) AS full_name, d.definition
    FROM raw.objects o
    INNER JOIN raw.definitions d ON o.server_name = d.server_name AND o.database_name = d.database_name AND o.object_id = d.object_id
    INNER JOIN meta.sources s ON o.server_name = s.server_name AND o.database_name = s.database_name
    WHERE o.object_type_code IN ('V', 'FN', 'IF', 'TF')
      AND d.definition IS NOT NULL AND d.definition <> '';
END;
GO

-- Save external objects from parser
CREATE OR ALTER PROCEDURE meta.sp_save_external_objects
    @objects_json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO meta.external_objects (source_id, ref_type, ref_name, display_name)
    SELECT j.i, j.t, j.r, j.d
    FROM OPENJSON(@objects_json)
    WITH (
        i INT '$.i',
        t TINYINT '$.t',
        r NVARCHAR(500) '$.r',
        d NVARCHAR(256) '$.d'
    ) j;
END;
GO

-- Save parsed edges from parser
CREATE OR ALTER PROCEDURE meta.sp_save_parsed_edges
    @edges_json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY

        SELECT
            j.i AS source_id,
            j.s AS src_object_id,
            j.t AS tgt_object_id,
            j.ext_src,
            j.ext_tgt,
            ISNULL(j.st, 0) AS source_type,
            ISNULL(j.tt, 0) AS target_type
        INTO #edges
        FROM OPENJSON(@edges_json) WITH (
            i INT '$.i',
            s BIGINT '$.s',
            t BIGINT '$.t',
            ext_src NVARCHAR(500) '$.ext_src',
            ext_tgt NVARCHAR(500) '$.ext_tgt',
            st TINYINT '$.st',
            tt TINYINT '$.tt'
        ) j
        WHERE j.i IS NOT NULL;

        INSERT INTO meta.parsed_edges (source_id, source_object_id, target_object_id, source_type, target_type)
        SELECT DISTINCT
            e.source_id,
            COALESCE(e.src_object_id, ext_s.object_id) AS source_object_id,
            COALESCE(e.tgt_object_id, ext_t.object_id) AS target_object_id,
            e.source_type,
            e.target_type
        FROM #edges e
        LEFT JOIN meta.external_objects ext_s
            ON e.ext_src IS NOT NULL AND ext_s.source_id = e.source_id AND ext_s.ref_name = e.ext_src
        LEFT JOIN meta.external_objects ext_t
            ON e.ext_tgt IS NOT NULL AND ext_t.source_id = e.source_id AND ext_t.ref_name = e.ext_tgt
        WHERE COALESCE(e.src_object_id, ext_s.object_id) IS NOT NULL
          AND COALESCE(e.tgt_object_id, ext_t.object_id) IS NOT NULL
          AND COALESCE(e.src_object_id, ext_s.object_id) <> COALESCE(e.tgt_object_id, ext_t.object_id);

        DROP TABLE #edges;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF OBJECT_ID('tempdb..#edges') IS NOT NULL DROP TABLE #edges;
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- Save parser debug logs
CREATE OR ALTER PROCEDURE meta.sp_save_parser_log
    @logs_json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO meta.parser_log (
        run_id, run_started_at, db_name, server_name,
        sp_object_id, sp_full_name, raw_ddl, cleaned_ddl, parsing_steps, edge_count, status, error_message
    )
    SELECT
        CAST(j.run_id AS UNIQUEIDENTIFIER),
        CAST(j.run_started_at AS DATETIME2),
        j.db_name,
        j.server_name,
        CAST(j.sp_object_id AS BIGINT),
        j.sp_full_name,
        j.raw_ddl,
        j.cleaned_ddl,
        j.parsing_steps,
        CAST(j.edge_count AS INT),
        j.status,
        j.error_message
    FROM OPENJSON(@logs_json)
    WITH (
        run_id NVARCHAR(36) '$.run_id',
        run_started_at NVARCHAR(50) '$.run_started_at',
        db_name NVARCHAR(128) '$.db_name',
        server_name NVARCHAR(256) '$.server_name',
        sp_object_id NVARCHAR(20) '$.sp_object_id',
        sp_full_name NVARCHAR(257) '$.sp_full_name',
        raw_ddl NVARCHAR(MAX) '$.raw_ddl',
        cleaned_ddl NVARCHAR(MAX) '$.cleaned_ddl',
        parsing_steps NVARCHAR(MAX) '$.parsing_steps' AS JSON,
        edge_count NVARCHAR(10) '$.edge_count',
        status NVARCHAR(50) '$.status',
        error_message NVARCHAR(MAX) '$.error_message'
    ) AS j;
END;
GO

-- Search DDL by text pattern
CREATE OR ALTER PROCEDURE meta.sp_search_ddl
    @query NVARCHAR(500),
    @schemas NVARCHAR(2000) = NULL,
    @types NVARCHAR(500) = NULL,
    @source_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @resolved_source_id INT;
    DECLARE @server_name NVARCHAR(256);
    DECLARE @database_name NVARCHAR(128);

    IF @source_id IS NOT NULL
        SELECT @resolved_source_id = source_id, @server_name = server_name, @database_name = database_name
        FROM meta.sources WHERE source_id = @source_id;
    ELSE
        SELECT TOP 1 @resolved_source_id = source_id, @server_name = server_name, @database_name = database_name
        FROM meta.sources WHERE is_active = 1;

    DECLARE @pattern NVARCHAR(502) = '%' + @query + '%';

    DECLARE @schemaFilter TABLE (schema_name NVARCHAR(128));
    DECLARE @typeFilter TABLE (object_type NVARCHAR(50));

    IF @schemas IS NOT NULL AND LEN(@schemas) > 0
    BEGIN
        INSERT INTO @schemaFilter (schema_name)
        SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@schemas, ',');
    END;

    IF @types IS NOT NULL AND LEN(@types) > 0
    BEGIN
        INSERT INTO @typeFilter (object_type)
        SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@types, ',');
    END;

    SELECT
        @resolved_source_id AS source_id,
        o.object_id,
        o.schema_name,
        o.object_name,
        CASE
            WHEN o.object_type_code = 'U' THEN 'Table'
            WHEN o.object_type_code = 'V' THEN 'View'
            WHEN o.object_type_code = 'P' THEN 'Stored Procedure'
            WHEN o.object_type_code IN ('FN', 'IF', 'TF') THEN 'Function'
            ELSE o.object_type_code
        END AS object_type,
        d.definition AS ddl_text,
        CASE
            WHEN CHARINDEX(@query, d.definition) > 0 THEN
                '...' +
                SUBSTRING(
                    d.definition,
                    CASE
                        WHEN CHARINDEX(@query, d.definition) > 100 THEN CHARINDEX(@query, d.definition) - 100
                        ELSE 1
                    END,
                    200 + LEN(@query)
                ) +
                '...'
            WHEN CHARINDEX(@query, o.object_name) > 0 THEN
                o.schema_name + '.' + o.object_name
            ELSE
                LEFT(ISNULL(d.definition, o.object_name), 200)
        END AS snippet
    FROM raw.objects o
    LEFT JOIN raw.definitions d ON o.server_name = d.server_name AND o.database_name = d.database_name AND o.object_id = d.object_id
    WHERE o.server_name = @server_name AND o.database_name = @database_name
      AND (
          o.object_name COLLATE Latin1_General_CI_AS LIKE @pattern
          OR d.definition COLLATE Latin1_General_CI_AS LIKE @pattern
      )
      AND (
          NOT EXISTS (SELECT 1 FROM @schemaFilter)
          OR o.schema_name IN (SELECT schema_name FROM @schemaFilter)
      )
      AND (
          NOT EXISTS (SELECT 1 FROM @typeFilter)
          OR CASE
                WHEN o.object_type_code = 'U' THEN 'Table'
                WHEN o.object_type_code = 'V' THEN 'View'
                WHEN o.object_type_code = 'P' THEN 'Stored Procedure'
                WHEN o.object_type_code IN ('FN', 'IF', 'TF') THEN 'Function'
                ELSE o.object_type_code
             END IN (SELECT object_type FROM @typeFilter)
      )
    ORDER BY o.schema_name, o.object_name;
END;
GO

-- Set active source warehouse
CREATE OR ALTER PROCEDURE meta.sp_set_active_source
    @source_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @source_id IS NOT NULL
    BEGIN
        BEGIN TRANSACTION
            UPDATE meta.sources SET is_active = 0 WHERE is_active = 1;
            UPDATE meta.sources SET is_active = 1 WHERE source_id = @source_id;
        COMMIT
    END
    ELSE IF NOT EXISTS (SELECT 1 FROM meta.sources WHERE is_active = 1)
    BEGIN
        UPDATE meta.sources SET is_active = 1
        WHERE source_id = (
            SELECT TOP 1 source_id FROM meta.sources ORDER BY database_name
        );
    END
END;
GO
