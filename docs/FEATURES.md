# Feature Reference

![Data Lineage GUI](images/data-lineage-gui.png)

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
- **Legend** - Collapsible schema color legend

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
| Double-click | Quick trace (uses default levels from Settings) |
| Right-click | Context menu: Trace, View SQL |
| Background click | Reset highlighting |

## Trace Mode

| Method | Description |
|--------|-------------|
| Double-click | Quick trace (uses default levels from Settings) |
| Right-click > Trace | Configure depth (0-99 or All) |

## Filtering

| Filter | Location | Options |
|--------|----------|---------|
| Schema | Toolbar popover | Multi-select; star icon sets Focus Schema (shows only direct neighbors) |
| Type | Toolbar popover | Table, View, SP, Function + Data Model types |
| Hide Isolated | Toolbar toggle | Hides unconnected nodes |
| Exclude Patterns | Settings | Hide matching objects |

### Pattern Syntax

Use `*` as wildcard: `staging*` (starts with), `*_temp` (ends with), `*test*` (contains).

## Search & DDL Viewer

| Feature | Access |
|---------|--------|
| Toolbar Search | Object name search |
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
| Export | Save graph as image |
| Help | Open help panel |
| Database | Switch active source |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No data | Check GraphQL endpoint in Settings, verify connection |
| No edges | Run DDL parser pipeline, check Fabric DB |
