# fc-gpt Phase 7 API and Data Ownership

Phase 7 goal: make the current `fc-gpt` branch understandable enough to maintain without rediscovering route ownership, endpoint usage, or Azure SQL dependencies by hand.

## Outcome

- Production UI routes are now mapped to their API clients and Azure SQL objects.
- The extracted Sales route graph is corrected so `sales`, `details/lead/*`, `details/opportunity/*`, `details/quote/*`, and `details/contract/*` render from `App.jsx`.
- Azure SQL ownership boundaries, mutation expectations, partial-data behavior, and remaining seed-data maturity gaps are documented below.

## Route, API, and SQL Ownership

| UI module or route | Frontend client | API endpoints | Azure SQL objects | Notes |
| --- | --- | --- | --- | --- |
| `dashboard` | `platformApi`, `opsApi` | `GET /api/platform/bootstrap`, `GET /api/platform/customer-service/overview`, `GET /api/ops/bootstrap` | `ms.vSalesModuleDashboard`, `billing.Customers`, `billing.CustomerProfiles`, `ms.*`, `care.Tickets`, `ops.Orders`, `ops.NetworkEvents`, `ops.ProvisioningJobs`, `ops.Settlements` | Uses `Promise.allSettled` and renders available data when one source fails. |
| `knowledge` | `platformApi`, `assistantApi` | `GET /api/platform/knowledge/bootstrap`, `GET /api/platform/knowledge/documents`, `GET /api/platform/knowledge/topics`, `GET /api/assistant/ui-overrides`, `POST /api/assistant/chat` | `knowledge.Documents`, `knowledge.Topics`, `knowledge.DocumentTopics`, `ai.UiOverrides`, `ai.Conversations`, `ai.Messages`, `ai.ChangeRequests`, `ai.AuditLog` | Knowledge content is API-backed. Assistant overlay is a separate `ai.*` surface. |
| `sales` | `salesApi` | `GET /api/sales/bootstrap` plus `GET/POST/PUT/DELETE` across `/api/sales/leads`, `/accounts`, `/opportunities`, `/custom-pricing`, `/quotes`, `/approvals`, `/contracts`; `GET /api/billing/*`; `POST /api/sales/serviceability/check` | `ms.Leads`, `ms.LeadActivities`, `ms.Accounts`, `ms.Opportunities`, `ms.OpportunityProducts`, `ms.OpportunityNotes`, `ms.CustomPricingRequests`, `ms.Quotes`, `ms.QuoteLineItems`, `ms.PricingInputs`, `ms.PricingResults`, `ms.Approvals`, `ms.Contracts`, `ms.ContractFiles`, `ms.ContractHistory`, `ms.ServiceabilityChecks`, `ms.v*` detail views, `billing.*` catalog tables and views | The extracted sales workspace is now mounted directly from `App.jsx`. |
| `reports` | `platformApi` | `GET /api/platform/reports/definitions`, `GET /api/platform/reports/{reportId}` | `report.vReportDefinitions`, `ms.vQuoteDetail`, `ms.vOpportunityDetail`, `billing.Customers`, `billing.CustomerProfiles` | Report result sets vary by report id. |
| `administration` | `platformApi`, `opsApi`, `opsMutations` | `GET /api/platform/administration/summary`, `GET /api/admin/users`, `GET /api/admin/roles`, `GET /api/admin/integrations`, `POST /api/admin/users`, `POST /api/admin/roles`, `POST /api/admin/integrations` | `admin.Users`, `admin.Roles`, `admin.Integrations` | Summary route is read-only aggregation; create routes write directly to `admin.*`. |
| `product-pricing` | `platformApi`, `salesApi` | `GET /api/platform/product-pricing/overview`, `GET /api/billing/products`, `/product-hierarchy`, `/billing-codes`, `/billing-elements`, `/offers`, `/promotions`, `/rate-plans` | `billing.Products`, `billing.Services`, `billing.ProductHierarchy`, `billing.vProductBillingHierarchy`, `billing.BillingCodes`, `billing.BillingElements`, `billing.Offers`, `billing.Promotions`, `billing.RatePlans` | Uses multi-source partial-data warnings. |
| `customer-360` | `platformApi`, `salesApi` | `GET /api/platform/bootstrap`, `GET /api/platform/customer-360/{customerNumber}`, `GET /api/billing/customers`, `GET /api/billing/customers/{customerNumber}` | `billing.Customers`, `billing.CustomerProfiles`, `billing.ServiceLocations`, `ms.Accounts`, `ms.vOpportunityDetail`, `ms.vQuoteDetail`, `ms.vContractDetail` | Bootstrap customer list is a fallback when billing customer list fails. |
| `customer-service` | `platformApi` | `GET /api/platform/customer-service/overview`, `GET /api/platform/customer-service/tickets`, `POST /api/platform/customer-service/tickets`, `PUT /api/platform/customer-service/tickets/{ticketId}`, `POST /api/platform/customer-service/tickets/{ticketId}/notes` | `care.Tickets`, `care.TicketNotes`, supporting joins to `billing.Customers`, `billing.CustomerProfiles` | Ticket create/update operations also create notes when supplied. |
| `billing` | `opsApi`, `opsMutations`, `salesApi` | `GET /api/billing-workflows/invoices`, `GET /api/billing-workflows/invoices/{invoiceId}`, `GET /api/billing-workflows/invoices/{invoiceId}/actions`, `GET /api/billing-workflows/adjustments`, `POST /api/billing-workflows/invoices/{invoiceId}/actions`, `POST /api/billing-workflows/adjustments`, `GET /api/billing/customers` | `billingops.Invoices`, `billingops.InvoiceActions`, `billingops.Adjustments`, `billing.Customers` | Workflow reads come from `billingops.*`; customer tab comes from billing master data. |
| `orders` | `opsApi`, `opsMutations` | `GET /api/ops/bootstrap`, `GET /api/ops/orders`, `GET /api/ops/provisioning-jobs`, `POST /api/ops/orders`, `PUT /api/ops/orders/{orderId}`, `POST /api/ops/provisioning-jobs`, `PUT /api/ops/provisioning-jobs/{jobId}` | `ops.Orders`, `ops.ProvisioningJobs` | Order detail also depends on ops bootstrap collections. |
| `network`, `service-management`, `provisioning`, `carrier-settlement` | `opsApi`, `opsMutations` | `GET /api/ops/bootstrap`, `GET /api/ops/network-events`, `GET /api/ops/provisioning-jobs`, `GET /api/ops/carrier-settlement`, `POST /api/ops/network-events`, `POST /api/ops/provisioning-jobs`, `POST /api/ops/carrier-settlement` | `ops.NetworkEvents`, `ops.ProvisioningJobs`, `ops.Settlements` | These routes share `ServiceOpsModule`. |
| `details/customer/*`, `details/account/*`, `details/billing-account/*` | `platformApi`, `salesApi` | `GET /api/platform/customer-360/{customerNumber}`, `GET /api/billing/customers/{customerNumber}`, `GET /api/billing/customers` | `billing.Customers`, `billing.CustomerProfiles`, `billing.ServiceLocations`, `ms.*` customer-linked commercial records | Uses warning banners when one supporting source fails. |
| `details/invoice/*` | `opsApi`, `salesApi` | `GET /api/billing-workflows/invoices/{invoiceId}`, `GET /api/billing-workflows/invoices/{invoiceId}/actions`, `GET /api/billing-workflows/adjustments`, `GET /api/billing/customers` | `billingops.Invoices`, `billingops.InvoiceActions`, `billingops.Adjustments`, `billing.Customers` | Uses warning banners when invoice support collections partially fail. |
| `details/order/*` | `opsApi` | `GET /api/ops/bootstrap`, `GET /api/ops/orders`, `GET /api/ops/provisioning-jobs` | `ops.Orders`, `ops.ProvisioningJobs`, `ops.NetworkEvents`, `ops.Settlements` | Detail is reconstructed from bootstrap and list data, not a dedicated order-detail endpoint. |
| `details/product/*`, `details/product-pricing/*` | `platformApi`, `salesApi` | same as `product-pricing` | same as `product-pricing` | Uses warning banners when reference sources partially fail. |
| `details/ticket/*` | `platformApi` | `GET /api/platform/customer-service/tickets/{ticketId}`, `PUT /api/platform/customer-service/tickets/{ticketId}`, `POST /api/platform/customer-service/tickets/{ticketId}/notes` | `care.Tickets`, `care.TicketNotes` | Dedicated detail endpoint exists. |
| `details/network/*` | `opsApi` | `GET /api/ops/bootstrap` | `ops.NetworkEvents` | Detail is reconstructed from bootstrap rows, not a dedicated event-detail endpoint. |

## Azure SQL Ownership Boundaries

| Schema | Primary owner in this branch | Used for |
| --- | --- | --- |
| `ms` | Sales domain | Leads, accounts, opportunities, quotes, approvals, contracts, serviceability checks, and sales-facing views. |
| `billing` | Customer and catalog domain | Customer master data, service locations, products, hierarchy, billing codes, billing elements, offers, promotions, and rate plans. |
| `report` | Platform reporting | Read-only report definitions and sort metadata. |
| `knowledge` | Knowledge content domain | Documents, topics, and document-topic mapping. |
| `care` | Customer service domain | Tickets and ticket notes. |
| `ops` | Operations domain | Orders, provisioning jobs, network events, and settlements. |
| `billingops` | Billing workflow domain | Invoices, invoice actions, and adjustments. |
| `admin` | Platform administration domain | Users, roles, integrations. |
| `ai` | Assistant domain | Conversations, messages, UI overrides, change requests, audit log. |

## Mutation and Transaction Expectations

- Single-record writes:
  `ops_write.py` and most simple sales CRUD endpoints use one insert or update plus a readback query. These are currently single-connection, single-commit operations.
- Multi-table sales writes:
  `sales.py` handles lead conversion, quote creation, quote pricing, quote approval submission, approval decisions, contract file/history writes, and serviceability persistence across multiple `ms.*` tables. These flows should stay inside one connection and commit boundary per request because they create state transitions, not isolated records.
- Customer service writes:
  ticket creation writes `care.Tickets` and an initial `care.TicketNotes` row together; ticket updates may also append a note. These should remain atomic per request.
- Compatibility order creation:
  `POST /api/sales/quotes/{quoteId}/convert-to-order` in `sales_compat.py` creates an `ops.Orders` row from sales state. This is the current bridge between quote approval workflows and operations.
- Missing shared transaction helper:
  The branch has a shared read/write helper in `sql_access.py`, but it does not yet provide an explicit reusable transaction wrapper. Multi-table handlers still manage transaction scope inline.

## Partial-Data and Staging Behavior

- `dashboard`:
  Uses `Promise.allSettled` across platform, customer-service, and ops bootstrap calls. If one fails, the page stays up and shows an inline message that some sources returned no data.
- `customer-360`:
  Falls back from billing customer list to platform bootstrap customers, then uses `Promise.allSettled` for detail hydration. Warning banners explain which customer sources are unavailable.
- `product-pricing` and product detail:
  Use `Promise.allSettled` across eight pricing and catalog sources. If some sources fail but at least one returns rows, the page renders with a warning banner.
- `invoice`, `order`, and `customer` detail:
  Keep the page shell up and show warning banners when supporting collections fail.
- `knowledge`:
  Does not yet implement partial-data merge behavior. `KnowledgeModule` treats `/api/platform/knowledge/bootstrap` as a required load and renders a hard error state if it fails.
- `KnowledgeAssistant`:
  Separately requests `/api/assistant/ui-overrides?scope=knowledge`. A failure there is shown inside the assistant surface and does not block the page shell.

## Local Development, Smoke Mode, and Seed Data

- Explicit smoke-only data:
  `pricing-microservice/app/services/smoke_data.py` remains the allowed in-memory fallback when `PLATFORM_RUNTIME_SMOKE_MODE` is enabled.
- Retired frontend mock data:
  `web-ui/src/data/mockData.js`, `web-ui/src/LegacyPortal.jsx`, and `web-ui/src/components/SalesCRM.jsx` are no longer part of the production route graph. They remain legacy/reference material only.
- Shared-database seed behavior still present:
  `ensure_sales_storage()`, `ensure_ops_storage()`, and `ensure_customer_service_storage()` can still create tables and seed rows into Azure SQL when the target tables are empty. This is no longer frontend fake data, but it is still synthetic operational data in the shared database and should be treated as an interim bootstrap strategy.

## Decisions and Blockers

- Knowledge stays API-backed.
  The branch should continue using `/api/platform/knowledge/*` for knowledge content and `/api/assistant/*` for assistant overlays rather than returning to local document fixtures.
- Blocker:
  Knowledge still lacks a partial-data strategy. A `404 Not Found` from a knowledge-side request is currently visible in staging instead of degrading to a warning banner.
- Blocker:
  Startup-time DDL and seed insertion are still embedded in API startup helpers. Deployment should eventually rely on source-controlled migrations and explicit seed steps instead of mutating shared Azure SQL opportunistically.
- Blocker:
  There is still no common transaction helper for multi-table writes, so transaction behavior is correct by convention inside handlers rather than enforced through one shared abstraction.
- Known auth maturity gap:
  Backend role enforcement is real, but the active role still comes from `X-User-Role` or `X-Demo-Role` headers rather than signed identity.

## Validation Notes

Phase 7 validation should at minimum keep passing:

- `npm run build` in `web-ui`
- route smoke coverage that includes `sales` and the sales detail routes
- `git diff --check`
