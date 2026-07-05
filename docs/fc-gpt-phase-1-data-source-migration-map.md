# fc-gpt Phase 1 Data Source Migration Map

Phase 1 goal: identify every remaining fake/static data dependency, map each module to its API and Azure SQL targets, and define the owner phase for replacement or local-only retention.

## Environment Checked

- Azure subscription: `Azure subscription 1` / tenant `BDWUS`
- Azure SQL server: `bdwus.database.windows.net`
- Azure SQL database: `AZBDWUSP`
- Azure SQL resource group: `AZURE-SQL-PNG`
- Azure SQL tier: `GeneralPurpose`, `Gen5`, capacity `2`, max size `32GB`
- Azure Container App: `bdwusca`
- Container App resource group: `AZURE-SQL-PNG`
- Container App FQDN: `bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io`

## Azure SQL Object Inventory

Read-only validation confirmed `57` user tables/views in `AZBDWUSP`.

Schemas present:

- `admin`
- `ai`
- `billing`
- `billingops`
- `care`
- `dbo`
- `ms`
- `ops`

Important tables and row counts:

| Area | SQL objects | Current row counts |
| --- | --- | --- |
| Sales CRM | `ms.Accounts`, `ms.Leads`, `ms.LeadActivities`, `ms.Opportunities`, `ms.OpportunityProducts`, `ms.OpportunityServices`, `ms.OpportunityNotes`, `ms.Quotes`, `ms.QuoteLineItems`, `ms.PricingInputs`, `ms.PricingResults`, `ms.Approvals`, `ms.CustomPricingRequests`, `ms.Contracts`, `ms.ContractFiles`, `ms.ContractHistory`, `ms.ServiceabilityChecks` | Accounts `5`, Leads `9`, Opportunities `3`, Quotes `3`, Approvals `2`, Contracts `2` |
| Sales views | `ms.vSalesModuleDashboard`, `ms.vLeadDetail`, `ms.vOpportunityDetail`, `ms.vQuoteDetail`, `ms.vContractDetail`, `ms.vCustomerLookup`, `ms.vPricingContext` | Present |
| Billing and product catalog | `billing.Customers`, `billing.CustomerProfiles`, `billing.ServiceLocations`, `billing.Products`, `billing.Services`, `billing.ProductHierarchy`, `billing.BillingCodes`, `billing.BillingElements`, `billing.Offers`, `billing.Promotions`, `billing.RatePlans` | Customers `5`, Products `8`, Services `5`, BillingElements `0`, RatePlans `8` |
| Billing views | `billing.vCustomerLookup`, `billing.vCustomerPricingProfile`, `billing.vProductBillingHierarchy` | Present |
| Billing workflows | `billingops.Invoices`, `billingops.InvoiceActions`, `billingops.Adjustments` | Invoices `2`, InvoiceActions `2`, Adjustments `3` |
| Operations | `ops.Orders`, `ops.NetworkEvents`, `ops.ProvisioningJobs`, `ops.Settlements` | Orders `3`, NetworkEvents `2`, ProvisioningJobs `3`, Settlements `2` |
| Customer service | `care.Tickets`, `care.TicketNotes` | Tickets `4`, TicketNotes `4` |
| Administration | `admin.Users`, `admin.Roles`, `admin.Integrations` | Users `3`, Roles `2`, Integrations `2` |
| Assistant/Knowledge support | `ai.Conversations`, `ai.Messages`, `ai.ChangeRequests`, `ai.AuditLog`, `ai.UiOverrides` | Conversations `20`, Messages `52`, ChangeRequests `12`, AuditLog `31`, UiOverrides `5` |
| System/support | `dbo.BuildVersion`, `dbo.ErrorLog` | BuildVersion `1`, ErrorLog `0` |

Known database gaps for later phases:

- `billing.BillingElements` exists but has no rows.
- Knowledge documents/topics are not database-backed yet.
- Report definitions are static in API code even though report rows are SQL-backed.
- Administration summary still uses static defaults from API code instead of `admin.*` tables.
- Some schemas are created at runtime from service modules; Phase 2 should move that DDL into source-controlled migrations.

## Frontend Fake/Static Data Inventory

Production-sensitive local data still exists in `web-ui/src/data/mockData.js`.

Current imports:

| Consumer | Imported data | Usage | Phase owner |
| --- | --- | --- | --- |
| `web-ui/src/components/Shell.jsx` | `navGroups`, `topNavSections` | UI navigation configuration | Retain as app config unless navigation becomes API-managed. Not fake business data. |
| `web-ui/src/modules/knowledge/KnowledgeModule.jsx` | `knowledgeDocuments`, `knowledgeTopics` | Primary Knowledge page content | Phase 4 replacement after Phase 2/3 add Knowledge SQL/API source. |
| `web-ui/src/components/SalesCRM.jsx` | `customers`, `leads`, `opportunities`, `quotes`, `contracts` | Legacy/static sales UI component | Remove or isolate as legacy-only after confirming it is not used by active routes. |
| `web-ui/src/LegacyPortal.jsx` | many mock datasets | Legacy portal fallback/older UI surface | Keep out of production route path or retire after active modules cover all workflows. |

Modern active modules are mostly API-backed:

- Dashboard uses `fetchPlatformBootstrap`, `fetchCustomerServiceOverview`, and `fetchOpsBootstrap`.
- Sales uses `web-ui/src/components/SalesDatabaseCRM.jsx` and `web-ui/src/utils/salesApi.js`.
- Customer 360 uses `/api/platform/bootstrap`, `/api/platform/customer-360/{customerNumber}`, and `/api/billing/customers/{customerNumber}`.
- Customer Service uses `/api/platform/customer-service/*`.
- Orders, Operations, Billing, Administration, Reports, Product & Pricing, and detail pages use API utilities rather than direct local business data.

Frontend naming issue for later cleanup:

- Several buttons still say `Create sample ...` even though they call API mutation endpoints. These should be renamed once backend role enforcement and seeded-data behavior are settled.

## Backend Fake/Static/Generated Data Inventory

| Source | Current behavior | Production risk | Phase owner |
| --- | --- | --- | --- |
| `pricing-microservice/app/services/smoke_data.py` | In-memory smoke-mode payloads for deployed smoke/runtime checks | Acceptable only behind `PLATFORM_RUNTIME_SMOKE_MODE` | Retain as test/smoke-only fallback; ensure production does not enable it. |
| `pricing-microservice/app/services/sales.py::seed_if_empty` | Seeds billing, product, and sales data into Azure SQL when empty | Useful bootstrap, but seed data can look like production data | Phase 2 should move seed strategy into explicit migration/seed scripts with environment controls. |
| `pricing-microservice/app/services/ops.py::seed_ops_data` | Seeds ops, admin, and billing workflow rows into Azure SQL when empty | Same seed-vs-production ambiguity | Phase 2 should externalize seed data and make production seed behavior explicit. |
| `pricing-microservice/app/services/customer_service.py::seed_customer_service_data` | Generates care tickets from billing customers when empty | Generated records can be mistaken for source-of-truth care records | Phase 2 should define whether care seed rows are local/staging only. |
| `pricing-microservice/app/services/platform.py::DEFAULT_USERS`, `DEFAULT_ROLES`, `DEFAULT_INTEGRATIONS` | Static admin summary payloads | Conflicts with existing `admin.*` tables | Phase 3 should read `admin.Users`, `admin.Roles`, and `admin.Integrations`. |
| `pricing-microservice/app/services/platform.py::REPORT_DEFINITIONS` | Static report definition metadata | Rows are SQL-backed, definitions are not | Phase 2 should add report definition table/view or Phase 3 should expose a durable config source. |
| `pricing-microservice/app/services/platform.py::product_pricing_overview` | SQL-backed catalog plus SQL-derived summary; smoke mode uses in-memory data | Mostly acceptable | Fill `billing.BillingElements`; keep smoke path test-only. |
| `pricing-microservice/app/services/sales.py::serviceability_check` | Checks seeded `billing.ServiceLocations`, otherwise derives status from simple geography rules | Not a true network serviceability source | Phase 2/3 should add real serviceability table/API or mark this as rules-based interim behavior. |
| `pricing-microservice/app/services/assistant.py::offline_response` | Offline assistant response when model access is not available | Acceptable as degraded AI behavior, not business source data | Document as fallback only. |

## Module-To-API-To-Database Matrix

| Module | Current frontend APIs | Current backend source | Azure SQL target | Phase 1 disposition |
| --- | --- | --- | --- | --- |
| Dashboard | `/api/platform/bootstrap`, `/api/platform/customer-service/overview`, `/api/ops/bootstrap` | Mix of SQL-backed sales/bootstrap, SQL-backed care/ops, static admin snippets | `ms.*`, `billing.*`, `care.*`, `ops.*`, `admin.*` | Mostly SQL-backed; replace static admin snippets in Phase 3. |
| Knowledge | `ai` assistant endpoints plus local `knowledgeDocuments`/`knowledgeTopics` | Static frontend knowledge content; `ai.*` only supports assistant conversations/overrides/change requests | Add knowledge tables or views under `ai` or a dedicated `knowledge` schema | Needs Phase 2 schema and Phase 3 API before Phase 4 frontend replacement. |
| Sales | `/api/sales/*`, `/api/billing/*` | SQL-backed in `ms.*` and `billing.*`; compatibility routes also write SQL | `ms.*`, `billing.*` | Strongest SQL-backed area; seed strategy and transaction boundaries need hardening. |
| Customer 360 | `/api/platform/customer-360/{customerNumber}`, `/api/billing/customers`, `/api/billing/customers/{customerNumber}` | SQL-backed customer/account/location/opportunity/quote/contract joins | `billing.Customers`, `billing.CustomerProfiles`, `billing.ServiceLocations`, `ms.Accounts`, `ms.Opportunities`, `ms.Quotes`, `ms.Contracts` | SQL-backed; keep partial-data behavior while API contracts are normalized. |
| Customer Service | `/api/platform/customer-service/overview`, `/tickets`, `/tickets/{id}`, notes/mutations | SQL-backed `care.*`, initially seeded from `billing.Customers` if empty | `care.Tickets`, `care.TicketNotes`, plus customer joins to `billing.*` | SQL-backed, but seed-generated ticket behavior needs explicit staging/local designation. |
| Orders | `/api/ops/orders`, `/api/ops/provisioning-jobs`, ops mutations | SQL-backed `ops.*`, seeded if empty | `ops.Orders`, `ops.ProvisioningJobs` | SQL-backed; Phase 5 must enforce backend roles for mutations. |
| Product & Pricing | `/api/platform/product-pricing/overview`, `/api/billing/products`, `/product-hierarchy`, `/billing-codes`, `/billing-elements`, `/offers`, `/promotions`, `/rate-plans` | SQL-backed `billing.*`, with `billing.BillingElements` empty | `billing.Products`, `billing.Services`, `billing.ProductHierarchy`, `billing.BillingCodes`, `billing.BillingElements`, `billing.Offers`, `billing.Promotions`, `billing.RatePlans`, views | SQL-backed but needs `BillingElements` seed/source and catalog ownership cleanup. |
| Billing | `/api/billing-workflows/invoices`, `/invoices/{id}`, `/actions`, `/adjustments`, `/api/billing/customers` | SQL-backed `billingops.*` and `billing.*` | `billingops.Invoices`, `billingops.InvoiceActions`, `billingops.Adjustments`, `billing.Customers` | SQL-backed; Phase 5 role enforcement and transaction cleanup needed. |
| Network Events | `/api/ops/network-events` plus create mutation | SQL-backed `ops.NetworkEvents`, seeded if empty | `ops.NetworkEvents` | SQL-backed; clarify seed/prod source. |
| Service Management | `/api/ops/bootstrap`, `/api/ops/network-events`, `/api/ops/provisioning-jobs` | SQL-backed `ops.*` | `ops.NetworkEvents`, `ops.ProvisioningJobs`, `ops.Orders` | SQL-backed; shared with Orders/Ops. |
| Provisioning | `/api/ops/provisioning-jobs` plus create/update mutations | SQL-backed `ops.ProvisioningJobs` | `ops.ProvisioningJobs`, `ops.Orders` | SQL-backed; needs backend role enforcement. |
| Carrier Settlement | `/api/ops/carrier-settlement` plus create mutation | SQL-backed `ops.Settlements` | `ops.Settlements` | SQL-backed; consider dedicated finance schema later only if domain grows. |
| Reports | `/api/platform/reports/definitions`, `/api/platform/reports/{id}` | Definitions static in API; report rows SQL-backed from `ms.*` and `billing.*` | Existing data views plus a future `report`/`admin` metadata table for definitions | Rows are SQL-backed; definitions need durable storage in Phase 2/3. |
| Administration | `/api/platform/administration/summary`, `/api/admin/users`, `/roles`, `/integrations`, admin mutations | Summary uses static defaults; list/mutation endpoints use SQL-backed `admin.*` | `admin.Users`, `admin.Roles`, `admin.Integrations`; future role permission metadata | Replace static summary with SQL reads; add authoritative role model in Phase 5. |

## API Endpoint Groups

Core API base in frontend defaults:

- Sales/platform/ops API base defaults to `https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io`.

Read endpoints already backed by Azure SQL in normal runtime:

- `/api/sales/dashboard`
- `/api/sales/bootstrap`
- `/api/sales/leads`, `/api/sales/leads/{id}`, lead activities
- `/api/sales/accounts`, `/api/sales/accounts/{id}`
- `/api/sales/opportunities`, `/api/sales/opportunities/{id}`, products, notes
- `/api/sales/custom-pricing`, `/api/sales/quotes`, `/api/sales/approvals`, `/api/sales/contracts`
- `/api/billing/customers`, `/api/billing/products`, `/api/billing/product-hierarchy`, `/api/billing/billing-codes`, `/api/billing/billing-elements`, `/api/billing/offers`, `/api/billing/promotions`, `/api/billing/rate-plans`
- `/api/platform/bootstrap`, `/api/platform/customer-360/{customerNumber}`, `/api/platform/product-pricing/overview`
- `/api/platform/customer-service/overview`, `/api/platform/customer-service/tickets`, `/api/platform/customer-service/tickets/{id}`
- `/api/ops/bootstrap`, `/api/ops/orders`, `/api/ops/network-events`, `/api/ops/provisioning-jobs`, `/api/ops/carrier-settlement`
- `/api/admin/users`, `/api/admin/roles`, `/api/admin/integrations`
- `/api/billing-workflows/invoices`, `/api/billing-workflows/invoices/{id}`, `/api/billing-workflows/invoices/{id}/actions`, `/api/billing-workflows/adjustments`

Mutation endpoints that already write Azure SQL but need Phase 5 backend role enforcement:

- Sales create/update/delete endpoints for leads, accounts, opportunities, opportunity products, custom pricing, quotes, quote line items, approvals, contracts, and contract files.
- `/api/sales/leads/{id}/convert`
- `/api/sales/quotes/{id}/price`
- `/api/sales/quotes/{id}/submit-approval`
- `/api/sales/quotes/{id}/convert-to-order`
- `/api/sales/serviceability/check`
- `/api/platform/customer-service/tickets`, ticket update, ticket notes
- `/api/ops/orders`, order update, provisioning job create/update, network event create, carrier settlement create
- `/api/admin/users`, `/api/admin/roles`, `/api/admin/integrations`
- `/api/billing-workflows/invoices/{id}/actions`, `/api/billing-workflows/adjustments`

## Owner Phase For Each Remaining Fake/Data Issue

| Issue | Owner phase | Action |
| --- | --- | --- |
| Knowledge content is local mock data | Phase 2 and Phase 3, then Phase 4 | Add Knowledge SQL/API source, then replace frontend imports. |
| Legacy `SalesCRM` and `LegacyPortal` import broad fake datasets | Phase 4 | Confirm route usage, isolate as dev-only, or remove from production bundle. |
| Static nav metadata is stored with mock data | Phase 4 cleanup | Move nav config out of `mockData.js` into an app config module. |
| Static admin summary defaults in platform API | Phase 3 | Read from `admin.Users`, `admin.Roles`, and `admin.Integrations`. |
| Static report definitions | Phase 2 and Phase 3 | Add durable report definition table or config-backed API source. |
| Runtime seed functions create source-of-truth-looking demo rows | Phase 2 | Move DDL and seed data into explicit migrations/seed scripts with environment gates. |
| `billing.BillingElements` table is empty | Phase 2 | Add seed/source data or remove endpoint dependence if no longer needed. |
| Serviceability fallback derives status from simple geography rules | Phase 2 and Phase 3 | Add real serviceability source or explicitly label as interim rule engine. |
| Backend mutations have no authoritative role enforcement | Phase 5 | Add API-level permission checks before protected writes. |

## Phase 1 Completion Status

Completed:

- Frontend fake data imports inventoried.
- Backend smoke/static/generated data sources inventoried.
- Module-to-API-to-database matrix created.
- Azure SQL access validated read-only.
- Azure Container App target identified.
- Each fake/static dependency assigned to a later owner phase.

Not changed in Phase 1:

- No Azure SQL schema or data mutations were applied.
- No Container App configuration was changed.
- No frontend or backend runtime code was changed.
