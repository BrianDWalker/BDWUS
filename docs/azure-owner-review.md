# Azure owner review — 12 October 2026

Read-only inventory of Azure subscription 1 (`a8f3fd5d-0d2f-4715-b685-728b21d1cc10`). This is the only enabled subscription returned for the signed-in account. No Azure resource or database changes were performed.

## Current resources and actual September costs

Cost Management ActualCost, 1–30 September 2026, grouped by ResourceId, USD before tax; no next page.

| Resource | Finding | September cost |
| --- | --- | ---: |
| App Service app/plan BDWUS | Neither exists in this subscription | No matching charges |
| Databricks workspace | None exists in this subscription | No matching charges |
| AZBDWUSP | Free General Purpose serverless Gen5, 1 max / 0.5 min vCore, 32 GiB, auto-pause after 60 minutes, free-limit behavior AutoPause; currently paused | $0.00 |
| bdwuscr | Separate BDWUS registry | $4.99804 |
| workspaceazuresqlpngb07c | Separate BDWUS logging workspace | $0.000027 |
| BDWUS resource group total | Current observed cost | $4.99807 |
| Whole subscription | Includes AXIOM resources and AI consumption | $120.83856 |

Keep prod SQL on its existing free serverless offer. It already meets the requested cost controls. An existing paid database cannot be converted to the free offer in place; no migration is necessary here. Do not recreate, rename, drop or move AZBDWUSP.

AXIOM's existing shared registry is `crfinancialadvisor8a42vuti2u` and logging workspace is `log-financial-advisor-8a42-vuti2u`, in `rg-financial-advisor-8a42`, East US. Their September charges were $5.11424 and $65.29300 respectively. Sharing does not make ingestion free. No deletion of the old BDWUS registry/workspace is authorized.

## Proposed cost envelope

For a low-traffic 0.5 vCPU / 1 GiB portal with minReplicas=0, allow **$0–10/month dev** and **$0–25/month prod** incremental BDWUS costs, excluding shared AXIOM baseline costs, existing retained resources, optional AI usage and egress. These are planning estimates, not quotes or enforceable caps. Dev SQL uses its own free allowance and AutoPause at the free limit. Prod SQL is already $0 within its limits. Container Apps grants are shared across the subscription, so AXIOM can consume them first. Log ingestion may dominate cost. Budgets send alerts and do not stop spending.

Sources: [SQL free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer?view=azuresql), [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing), [Container Apps prices](https://azure.microsoft.com/en-us/pricing/details/container-apps/).

## Inventory commands (read-only)

```sh
az account list --query '[].{id:id,name:name,state:state}'
az resource list --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az sql db show -g AZURE-SQL-PNG -s bdwus -n AZBDWUSP
```

The remaining changes are prepared in separate PRs. Provisioning, deployment, Entra configuration, SQL migrations and access grants require explicit owner approval before execution.
