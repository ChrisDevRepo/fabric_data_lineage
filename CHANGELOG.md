# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [1.4.0] - 2026-01-07

### Performance
- Extended cache TTL from 24 hours to 7 days for faster repeat visits
- Added warm-up queries on app load to reduce cold-start delays

### Changed
- Removed unused MS boilerplate code (~4K LOC)

## [1.3.1] - 2026-01-03

### Fixed
- Infinite loop when GraphQL API fails (caused 429 rate limiting)
- Infinite loop when API returns empty data
- Retry counter showing multiple parallel counters
- Notebook now fails pipeline with descriptive error when no data found

### Changed
- Reduced max retry attempts from 5 to 3
- Single retry loop around parallel API calls (cleaner progress display)
- Better error messages with HTTP status and endpoint URL
- Notebook uses `mssparkutils.notebook.exit()` for pipeline-visible errors

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
