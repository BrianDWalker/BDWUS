# fc-gpt Phase 2 Legacy Route Inventory

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Current routing model

The current app entrypoint renders `SalesAppRouter`, which owns Sales and Sales detail routes first. Non-sales routes pass to `App.jsx`. `App.jsx` owns extracted module routes and sends anything else to `LegacyPortal`.

## Extracted / migrated owners

| Route or route family | Current owner | Phase 2 status | Notes |
|---|---|---:|---|
| `sales` | `SalesAppRouter` + `SalesDatabaseCRM` | Migrated, keep | API-backed sales workspace. Needs deeper workflow E2E later. |
| `details/lead/*` | `SalesAppRouter` + `SalesDatabaseCRM` | Migrated, keep | Sales detail owner. |
| `details/opportunity/*` | `SalesAppRouter` + `SalesDatabaseCRM` | Migrated, keep | Sales detail owner. |
| `details/quote/*` | `SalesAppRouter` + `SalesDatabaseCRM` | Migrated, keep | Sales detail owner. |
| `details/contract/*` | `SalesAppRouter` + `SalesDatabaseCRM` | Migrated, keep | Sales detail owner. |
| `reports` | `App.jsx` + `ReportsModule` | Migrated, keep | API-backed report catalog/results/export. |
| `administration` | `App.jsx` + `AdministrationModule` | Migrated, keep | API-backed admin summary/users/roles/integrations. |
| `product-pricing` | `App.jsx` + `ProductPricingModule` | Migrated, keep | API-backed catalog/pricing/billing references. |
| `customer-360` | `App.jsx` + `Customer360Module` | Migrated, keep | API-backed customer profile/commercial context. |
| `customer-service` | `App.jsx` + `CustomerServiceModule` | Migrated, keep | API-backed ticket/outage/care queue extraction added after the Phase 2 inventory. |
| `billing` | `App.jsx` + `BillingModule` | Migrated, keep | API-backed billing workflow surface. |
| `orders` | `App.jsx` + `OrdersModule` | Migrated, keep | API-backed order/provisioning workflow surface. |
| `network` | `App.jsx` + `ServiceOpsModule` | Migrated, keep | API-backed service operations surface. |
| `service-management` | `App.jsx` + `ServiceOpsModule` | Migrated, keep | API-backed service operations surface. |
| `provisioning` | `App.jsx` + `ServiceOpsModule` | Migrated, keep | API-backed provisioning surface. |
| `carrier-settlement` | `App.jsx` + `ServiceOpsModule` | Migrated, keep | API-backed carrier settlement surface. |
| `details/customer/*` | Normalized to `customer-360` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/account/*` | Normalized to `customer-360` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/billing-account/*` | Normalized to `customer-360` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/invoice/*` | Normalized to `billing` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/service/*` | Normalized to `billing` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/order/*` | Normalized to `orders` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/product/*` | Normalized to `product-pricing` | Guarded, keep | No longer intentionally legacy-owned. |
| `details/product-pricing/*` | Normalized to `product-pricing` | Guarded, keep | No longer intentionally legacy-owned. |

## Remaining intentional LegacyPortal surfaces

| Route or route family | Current owner | Decision | Reason |
|---|---|---|---|
| `dashboard` | `LegacyPortal` | Accept temporarily | Home dashboard is role/workday aggregation. It is not yet API-backed or extracted, but it is still useful as a launchpad. |
| `knowledge` | `LegacyPortal` | Accept temporarily, later migrate | Knowledge uses `KnowledgeAssistant` and assistant UI merge helpers. It should remain available until a dedicated API-backed Knowledge module is created. |
| `details/ticket/*` | `LegacyPortal` generic detail fallback | Accept temporarily | Customer-service list is extracted; ticket detail still needs a dedicated detail page or normalized ticket route. |
| `details/network/*` | `LegacyPortal` generic detail fallback | Review after ServiceOps detail design | Network detail may belong to ServiceOps after a deeper operations detail route is designed. |
| `details/record/*` | `LegacyPortal` generic detail fallback | Accept temporarily | Used by admin-style generic record links; not yet important enough to extract before Customer Service. |
| Unknown `details/*` | `LegacyPortal` generic detail fallback | Accept temporarily | Kept as a safety net for stale links until full route telemetry/testing exists. |

## Updated Phase 2 result

Customer Service has now moved out of intentional LegacyPortal ownership and into `web-ui/src/modules/customerService/CustomerServiceModule.jsx`, backed by `GET /api/platform/customer-service/overview`.

Do not delete `LegacyPortal` yet. The remaining meaningful legacy surfaces are now only `dashboard`, `knowledge`, and generic/stale detail fallbacks.

## What could not be fully completed in this extraction step

- I could not prove all routes in a browser because CI/run access is still not available from this chat.
- I did not remove legacy dashboard or knowledge because they are still useful and not yet replaced by extracted modules.
- I did not build a persistent ticket table/write API; the extracted Customer Service module preserves create-ticket as a UI draft action for now.
- I did not delete any LegacyPortal detail components because stale deep links may still rely on the generic fallback.
