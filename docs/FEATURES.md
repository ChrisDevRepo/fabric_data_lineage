# Feature Reference

## Graph Visualization

Interactive directed graph using ReactFlow with Dagre hierarchical layout.

### Node Types

| Type | Shape |
|------|-------|
| Table | Rectangle (solid) |
| View | Rectangle (solid) |
| SP/Function | Oval/Pill |
| External | Rectangle (dashed) |

### Visual Encoding

- **Schema Colors** - Automatic coloring by schema
- **Data Model Icons** - Diamond (Dim), Square (Fact), Circle (Other)
- **External Objects** - Dashed border, link badge
- **Legend** - Collapsible schema color legend (bottom-left)

### Navigation

| Gesture | Action |
|---------|--------|
| Scroll | Pan |
| Controls (+/-) | Zoom in/out |
| Drag | Pan canvas |
| Minimap | Pan and zoom overview |

## Node Interactions

| Action | Effect |
|--------|--------|
| Click | Highlight node + neighbors |
| Double-click | Quick trace (1 up, 1 down) |
| Right-click | Context menu: Trace, View SQL |
| Background click | Reset highlighting |

## Trace Mode

| Method | Description |
|--------|-------------|
| Double-click | Quick trace: 1 level up/down |
| Right-click > Trace | Configure depth (0-99 or All) |

## Filtering

| Filter | Location | Options |
|--------|----------|---------|
| Schema | Toolbar popover | Multi-select, Focus Schema |
| Type | Toolbar popover | Table, View, SP, Function + Data Model types |
| Hide Isolated | Toolbar toggle | Hides unconnected nodes |
| Exclude Patterns | Settings | Hide matching objects (SQL LIKE syntax) |

### Pattern Syntax

Use `%` as wildcard: `staging%` (starts with), `%_temp` (ends with), `%test%` (contains).

## Search & DDL Viewer

| Feature | Access |
|---------|--------|
| Toolbar Search | Real-time object name search |
| Detail Search | Ribbon button, full-text DDL search |
| View SQL | Right-click menu, Monaco editor |

## Settings

| Tab | Options |
|-----|---------|
| Connection | Demo Mode toggle, GraphQL endpoint, Test Connection |
| Data Model | Classification types/patterns, Exclude patterns |
| Preferences | Layout direction, Minimap, Controls visibility, Edge type, Remember Filters, Default trace levels |

## Ribbon Actions

| Button | Action |
|--------|--------|
| Save | Persist settings |
| Settings | Open settings panel |
| Refresh | Reload from GraphQL |
| Fit View | Auto-fit viewport |
| Expand | Toggle fullscreen mode |
| Detail Search | Full-text DDL search |
| Export | PNG export |
| Help | Open help panel |
| Database | Switch active source |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty graph | Check GraphQL endpoint in Settings |
| No edges | Run DDL parser pipeline |
| Slow load | Expected for 500+ nodes |
