# Web UI Module Migration Map

This document exists so GitHub-only agents can safely continue the React UI migration without replacing the full `web-ui/src/App.jsx` monolith at once.

Current state:
- Branch: `fc-gpt`
- Runtime entry: `web-ui/src/main.jsx`
- Router bridge: `web-ui/src/SalesAppRouter.jsx`
- Legacy UI fallback: `web-ui/src/App.jsx`
- API-backed sales UI: `web-ui/src/components/SalesDatabaseCRM.jsx`
- API client: `web-ui/src/utils/salesApi.js`
- Mock source still used by legacy modules: `web-ui/src/data/mockData.js`

## Current Route Split

`SalesAppRouter.jsx` already routes these screens to API-backed sales components:

| Route | Current component | Backend status |
| --- | --- | --- |
| `#/sales` | `SalesModule` from `SalesDatabaseCRM.jsx` | Uses `/api/sales/bootstrap` and sales CRUD endpoints |
| `#/details/lead/:id` | `SalesLeadDetail` | Uses `/api/sales/leads/*` |
| `#/details/opportunity/:id` | `SalesOpportunityDetail` | Uses `/api/sales/opportunities/*`, quote, contract, and billing reference endpoints |
| `#/details/quote/:id` | `SalesQuoteDetail` | Uses `/api/sales/quotes/*` |
| `#/details/contract/:id` | `SalesContractDetail` | Uses `/api/sales/contracts/*` |

Every other route falls back to `App.jsx`.

## Legacy App.jsx Section Boundaries

Use these line ranges as the initial extraction map. Line numbers may drift after edits, so prefer function names over exact lines when patching.

| Area | Function(s) in `App.jsx` | Suggested target file |
| --- | --- | --- |
| Shared route helpers | `currentHashRoute`, `useRoute`, `Toast` | `web-ui/src/routing/useRoute.js` or keep in router |
| Shared UI helpers | `ToolbarButton`, `SearchBox`, `Modal`, `MenuModal`, `MiniStat`, `ActionButton`, `Tabs`, `Breadcrumb`, `RecordHeader`, `SummaryStrip`, `TimelineList`, `FilterRibbon`, `DetailButton` | `web-ui/src/components/AppPrimitives.jsx` |
| Dashboard | `Dashboard` | `web-ui/src/modules/dashboard/Dashboard.jsx` |
| Legacy sales fallback | `SalesModule`, sales detail helpers if still present | Prefer replacing with `SalesDatabaseCRM.jsx`; avoid new work here |
| Knowledge | `KnowledgeModule` | `web-ui/src/modules/knowledge/KnowledgeModule.jsx` |
| Product and pricing | `ProductPricingModule`, `ProductPricingDetail`, `ProductDetail`, `productMeta` | `web-ui/src/modules/productPricing/*` |
| Customer service | `CustomerServiceModule` | `web-ui/src/modules/customerService/CustomerServiceModule.jsx` |
| Customer 360 | `Customer360Module`, customer detail helpers | `web-ui/src/modules/customer360/*` |
| Billing | `BillingModule`, `BillingAccountDetail`, `InvoiceDetail`, `ServiceDetail`, invoice helpers | `web-ui/src/modules/billing/*` |
| Orders | `OrdersModule`, `OrderDetail`, order helpers | `web-ui/src/modules/orders/*` |
| Service operations | `ServiceOpsModule` | `web-ui/src/modules/ops/ServiceOpsModule.jsx` |
| Administration | `AdministrationModule` | `web-ui/src/modules/admin/AdministrationModule.jsx` |
| Reports | `ReportsModule` | `web-ui/src/modules/reports/ReportsModule.jsx` |
| Detail router | `DetailPage` | `web-ui/src/routing/DetailPage.jsx` |
| Top-level app | `App` | Keep as the route composition shell after extraction |

## Existing Backend Endpoints

These endpoints exist in `pricing-microservice/app/services/sales.py` and `pricing-microservice/app/main.py`.

Sales:
- `GET /api/sales/dashboard`
- `GET /api/sales/bootstrap`
- `GET/POST /api/sales/leads`
- `GET/PUT/DELETE /api/sales/leads/{lead_id}`
- `POST /api/sales/leads/{lead_id}/convert`
- `GET/POST /api/sales/leads/{lead_id}/activities`
- `GET/POST /api/sales/accounts`
- `GET/PUT/DELETE /api/sales/accounts/{account_id}`
- `GET/POST /api/sales/opportunities`
- `GET/PUT/DELETE /api/sales/opportunities/{opportunity_id}`
- `GET/POST /api/sales/opportunities/{opportunity_id}/products`
- `PUT/DELETE /api/sales/opportunities/{opportunity_id}/products/{product_id}`
- `GET/POST /api/sales/opportunities/{opportunity_id}/notes`
- `GET/POST /api/sales/custom-pricing`
- `GET/PUT/DELETE /api/sales/custom-pricing/{request_id}`
- `POST /api/sales/custom-pricing/{request_id}/submit`
- `GET/POST /api/sales/quotes`
- `GET/PUT/DELETE /api/sales/quotes/{quote_id}`
- `GET/POST /api/sales/quotes/{quote_id}/line-items`
- `PUT/DELETE /api/sales/quotes/{quote_id}/line-items/{line_item_id}`
- `POST /api/sales/quotes/{quote_id}/price`
- `POST /api/sales/quotes/{quote_id}/submit-approval`
- `GET /api/sales/approvals`
- `GET /api/sales/approvals/{approval_id}`
- `POST /api/sales/approvals/{approval_id}/approve`
- `POST /api/sales/approvals/{approval_id}/reject`
- `POST /api/sales/approvals/{approval_id}/request-changes`
- `GET/POST /api/sales/contracts`
- `GET/PUT/DELETE /api/sales/contracts/{contract_id}`
- `GET/POST /api/sales/contracts/{contract_id}/files`
- `DELETE /api/sales/contracts/{contract_id}/files/{file_id}`
- `GET /api/sales/contracts/{contract_id}/history`
- `POST /api/sales/serviceability/check`

Billing reference data:
- `GET /api/billing/customers`
- `GET /api/billing/customers/{customer_number}`
- `GET /api/billing/customer-lookup/{customer_number}`
- `GET /api/billing/products`
- `GET /api/billing/products/{product_id}`
- `GET /api/billing/product-hierarchy`
- `GET /api/billing/billing-codes`
- `GET /api/billing/billing-elements`
- `GET /api/billing/offers`
- `GET /api/billing/promotions`
- `GET /api/billing/rate-plans`

Health and assistant:
- `GET /`
- `GET /health`
- `GET /health/ready`
- `GET /health/assistant`
- `GET /health/sales`
- `GET /health/pricing-context`
- `POST /api/assistant/chat`
- `GET /api/assistant/ui-overrides`
- `GET /api/assistant/github/branches`
- `GET /api/assistant/github/tree`
- `GET /api/assistant/github/file`
- `GET /api/assistant/github/commits`

Platform:
- `GET /api/platform/bootstrap`
- `GET /api/platform/reports/definitions`
- `GET /api/platform/reports/{report_id}`
- `GET /api/platform/administration/summary`
- `GET /api/platform/customer-360/{customer_number}`
- `GET /api/platform/product-pricing/overview`

Operations:
- `GET /api/ops/bootstrap`
- `GET/POST /api/ops/orders`
- `PUT /api/ops/orders/{order_id}`
- `GET /api/ops/network-events`
- `POST /api/ops/network-events`
- `GET/POST /api/ops/provisioning-jobs`
- `PUT /api/ops/provisioning-jobs/{job_id}`
- `GET/POST /api/ops/carrier-settlement`

Administration:
- `GET/POST /api/admin/users`
- `GET/POST /api/admin/roles`
- `GET/POST /api/admin/integrations`

Billing workflows:
- `GET /api/billing-workflows/invoices`
- `GET /api/billing-workflows/invoices/{invoice_id}`
- `GET/POST /api/billing-workflows/invoices/{invoice_id}/actions`
- `GET/POST /api/billing-workflows/adjustments`

## Target UI-To-API Mapping

Migrate modules in this order so each change can be reviewed and validated independently.

| Priority | Module | Current data source | Target source |
| --- | --- | --- | --- |
| 1 | Sales | Mixed, mostly complete in `SalesDatabaseCRM.jsx` | Keep using `/api/sales/bootstrap` plus sales CRUD |
| 2 | Product pricing | `services`, `pricingPrograms`, local derivations | `/api/platform/product-pricing/overview` plus `/api/billing/products`, hierarchy, codes, elements, offers, promotions, and rate plans |
| 3 | Customer 360 | `customers`, `orders`, `invoices`, `tickets`, derived helpers | `/api/platform/customer-360/{customer_number}` plus `/api/billing/customers/*` |
| 4 | Billing | `customers`, `invoices`, `adjustments`, local PDF/export helpers | `/api/billing-workflows/invoices`, invoice actions, adjustments, and `/api/billing/customers/*` |
| 5 | Orders | `orders`, local status derivation | `/api/ops/orders`, `/api/ops/provisioning-jobs`, `/api/ops/bootstrap` |
| 6 | Reports | `reportDefinitions`, `reportRows` | `/api/platform/reports/definitions` and `/api/platform/reports/{report_id}` |
| 7 | Administration | Mostly local simulated actions | `/api/platform/administration/summary`, `/api/admin/users`, `/api/admin/roles`, `/api/admin/integrations` |
| 8 | Service operations | `networkEvents`, `tickets`, local simulated actions | `/api/ops/network-events`, `/api/ops/provisioning-jobs`, `/api/ops/carrier-settlement` |

## Extraction Rules

For the first extraction commit:
- Move code without behavior changes.
- Keep existing prop names: `setRoute`, `showToast`, `route`, `id`.
- Keep imports from `mockData.js` local to each extracted module until the module is migrated.
- Avoid changing CSS class names.
- Run `npm run build` from `web-ui` after every module extraction.

For migration commits:
- Add API functions to `web-ui/src/utils/salesApi.js`.
- Load data with `useEffect` and local loading/error states.
- Keep a clear fallback for missing backend fields.
- Remove mock imports only from the module being migrated.
- Validate empty states and failed request states.

## Acceptance Criteria Per Module

Each migrated module is done only when:
- It no longer imports mock rows for records the backend owns.
- It shows loading, empty, and error states.
- Primary actions call backend mutation endpoints when those endpoints exist.
- It still builds with `npm run build`.
- The route can be opened directly with a hash URL.
- The module has a short note in the PR summary listing remaining mock-only areas, if any.
