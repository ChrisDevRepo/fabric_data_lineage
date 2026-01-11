# Changelog

All notable changes to this project are documented here.

## [1.3.3] - 2026-01-11

### Fixed
- Cache isolation between production and development environments
- Detail Search now opens reliably and focuses the selected node on close
- Database switching shows loading indicator
- Connection test shows retry progress

### Changed
- Export dialog: PNG/JPEG formats, optional legend, high-resolution (2x) option
- Refresh notification shows database name
- Detail Search filters stay in sync with main toolbar

### Added
- "Clear Cache" to Connection settings
- Offline database switching (cached data available during outages)

## [1.3.2] - 2026-01-09

### Changed
- DDL loaded on-demand
- Database cache preserved when switching between sources
- Simplified Quick Start section on landing page

## [1.3.1] - 2026-01-03

### Fixed
- Infinite retry loop when GraphQL API fails
- Improved error handling in notebook pipeline

### Added
- "No data found" message when database is empty

## [1.3.0] - 2026-01-02

### Added
- External objects support (FILE, OTHER_DB, LINK reference types)
- External type filter in toolbar

## [1.2.0] - 2025-12-28

### Added
- Database selector dropdown in ribbon
- Multi-warehouse support via `meta.sources` table

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
