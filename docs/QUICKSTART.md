# Quick Start

## 1. Try the Demo

### Admin Setup (one-time)

Your Fabric tenant admin must complete these steps:

1. **Enable unverified workloads** in Admin Portal
   Tenant settings → Additional workloads → Enable both settings:
   - "Capacity admins and contributors can add and remove additional workloads"
   - "Users can see and work with additional workloads not validated by Microsoft"
   [Documentation](https://learn.microsoft.com/en-us/fabric/admin/tenant-settings-index#additional-workloads)

2. **Grant tenant-wide admin consent** ([details](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent))

   For demo/testing, the hosted app can be used.*

   | | |
   |---|---|
   | **App** | Data Lineage Workload |
   | **Publisher** | Christian Wagner ([GitHub](https://github.com/ChrisDevRepo)) |
   | **Permissions requested** | `User.Read` (sign in and read user profile) |
   | **App ID** | `bdfe868d-343c-4513-b65e-90ef18ed501c` |

   **Consent URL** (Global Admin):
   ```
   https://login.microsoftonline.com/common/adminconsent?client_id=bdfe868d-343c-4513-b65e-90ef18ed501c
   ```

   > How Fabric workloads handle data: [Architecture](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/architecture)

3. **Upload the workload package**
   Admin Portal → Workloads → Upload workload
   Download: [`release/Org.DataLineage.1.3.3.nupkg`](../release/Org.DataLineage.1.3.3.nupkg)

   > **v1.3.3** - Package now included in repo for easy demo setup

### User Setup (in Fabric)

1. In Fabric: **+ New** → **Data Lineage** (under custom workloads)
2. Click **Refresh** in toolbar

Demo mode is enabled by default — explore the sample lineage graph.

---

## 2. Connect Your Warehouse

To visualize lineage from your Data Warehouse, follow the [setup guide](../setup/README.md).

This includes:
- Creating a SQL Database with the lineage schema
- Setting up a GraphQL API
- Configuring a data pipeline to extract metadata

---

## 3. Production Deployment

For production or internal use, clone this repo and deploy to your own Azure environment:

1. Clone: `git clone https://github.com/ChrisDevRepo/fabric_data_lineage`
2. Follow Microsoft docs to set up your own Entra app and Azure Static Web App:
   - [Register Entra ID application](https://learn.microsoft.com/en-us/fabric/workload-development-kit/authentication-tutorial)
   - [Host workload in Azure](https://learn.microsoft.com/en-us/fabric/workload-development-kit/deploy-to-azure)

---

> *The hosted demo (chwagner.eu) is for evaluation only — no availability guarantee. For production use, deploy your own instance.
