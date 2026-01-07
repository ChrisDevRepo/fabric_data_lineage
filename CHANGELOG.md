# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [1.4.0] - 2026-01-07
- Performance improvements: extended cache TTL, added warm-up queries

## [1.3.1] - 2026-01-03
- Hotfix: infinite retry loop when GraphQL API fails
- Improved error handling in notebook pipeline

### Added
- "No data found" message when database is empty (with troubleshooting hints)
- `hasAttemptedLoadSources` flag to prevent API call loops
- Troubleshooting section in setup docs
- SPN setup instructions in admin docs

## [1.3.0] - 2026-01-02

### Added
- External objects support (FILE, OTHER_DB, LINK reference types)
- Negative object IDs for external references
- External type filter in toolbar

### Changed
- Views now include `ref_type` and `ref_name` columns

## [1.2.0] - 2025-12-28

### Added
- Database selector dropdown in ribbon
- Multi-warehouse support via `meta.sources` table
- `sp_set_active_source` stored procedure

## [1.1.0] - 2025-12-20

### Added
- Trace mode (right-click context menu)
- Double-click quick trace
- Focus schema filter (1-hop neighbors)

### Changed
- Switched to graphology for graph operations

## [1.0.0] - 2025-12-15

### Added
- Initial release
- ReactFlow graph visualization
- DDL search with Monaco editor
- Schema and type filters
- Demo mode with sample data
- PNG export
