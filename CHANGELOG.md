# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [1.3.3] - 2026-01-11

### Fixed
- Prod/dev environments no longer share cached data
- Detail Search opens as panel (no empty window in dev mode), focuses selected node on close
- Database dropdown shows spinner while switching
- Test connection button shows retry progress (1/3, 2/3, 3/3)
- Fixed edges rendering to non-existent nodes when filters applied

### Changed
- Export dialog with PNG/JPEG formats, legend toggle, and high-res (2x) options
- Removed ReactFlow attribution link
- Refresh notification shows database name instead of "GraphQL"
- "Clear Cache" moved from Preferences to Connection tab
- Centered loading overlay for all refresh/loading states (consistent UX)
- Help panel footer simplified
- Filter settings now use 2-tier storage: localStorage for session (24h), explicit Save for team defaults
- DDLViewerPanel refactored to use shared DDLViewer component (reduced code duplication)
- Detail Search filters synced from editor via sessionStorage (no duplicate dropdowns)

### Added
- Spinner accessibility labels (aria-label)
- Offline database switching (dropdown and graph data cached for temporary outages)

## [1.3.2] - 2026-01-09

### Changed
- DDL loaded on-demand (only when viewing SQL) for faster initial graph load
- Database cache preserved when switching between sources
- Added `staticwebapp.config.json` for SPA routing (fixes 404 on deep links)
- Simplified Quick Start section on landing page (cleaner layout, less text)

## [1.3.1] - 2026-01-03

### Fixed
- Infinite retry loop when GraphQL API fails
- Improved error handling in notebook pipeline

### Added
- "No data found" message when database is empty
- `hasAttemptedLoadSources` flag to prevent API call loops
- Troubleshooting section in setup docs

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
