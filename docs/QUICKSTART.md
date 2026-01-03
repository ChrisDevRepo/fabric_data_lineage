# Quick Start

Try Fabric Data Lineage in minutes using Demo Mode.

## Prerequisites

- Fabric workspace (Contributor+ permissions)
- Workload enabled by admin (see [Admin Setup](ADMIN_SETUP.md))

## Try with Demo Mode

1. **+ New** > **Data Lineage** (under custom workloads)
2. Open **Settings** > **Connection** tab
3. Toggle **Demo Mode** on
4. Click **Refresh**

Explore the sample lineage graph to understand the features.

## Connect Real Data

For production use with your Data Warehouse:
1. Download assets from [`setup/`](https://github.com/ChrisDevRepo/fabric_data_lineage/tree/main/setup)
2. Follow the README in that folder

## Using the App

| Action | How |
|--------|-----|
| Navigate | Drag to pan, Controls (+/-) to zoom |
| Select | Click node to highlight connections |
| Trace | Right-click > Trace options |
| Search | Toolbar or Detail Search button |
| Filter | Schema/type dropdowns |
| Export | Export button (PNG) |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Workload not visible | Admin must enable in Admin Portal |
| No data | Run pipeline, check `raw.*` tables |
| Empty graph | Check GraphQL endpoint |
| GraphQL 403 | Verify database permissions |
