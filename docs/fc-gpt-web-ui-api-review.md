# fc-gpt Web UI + API Review Notes

This review focused on whether the migrated web UI still exposes expected portal functionality and whether the API-backed surfaces are wired well enough to avoid regressions from the prior legacy/mock-heavy implementation.

## Review scope

Reviewed areas:

- Web app entrypoint and route composition
- `App.jsx` extracted route shell
- `SalesAppRouter.jsx` sales route integration
- `LegacyPortal.jsx` fallback behavior
- Extracted modules:
  - Reports
  - Administration
  - Product & Pricing
  - Customer 360
  - Billing
  - Orders
  - Service Operations
- API helper clients:
  - `salesApi.js`
  - `platformApi.js`
  - `opsApi.js`
  - `opsMutations.js`
- Backend routers:
  - sales
  - billing
  - platform aggregation
  - ops/admin/billing-workflows
  - sales compatibility routes added during this review
- Playwright route smoke and mutation coverage
- Backend contract coverage

## Confirmed good state

- `main.jsx` intentionally renders `SalesAppRouter`, not `App`, so database-backed Sales routes can be integrated before non-sales traffic falls through to the modular app shell.
- `App.jsx` is a small shell for extracted modules instead of the prior monolith.
- Extracted routes are wired for reports, administration, product-pricing, customer-360, billing, orders, network, service-management, provisioning, and carrier-settlement.
- Sales API, platform API, ops API, and mutation clients use consistent deployed API fallback behavior.
- Existing validation runs are configured to cover web build, browser route smoke, backend tests, runtime smoke, staging smoke, and deployed web smoke.

## Issues found and fixed

### 1. Migrated detail routes could fall back to legacy unintentionally

Problem:

Some detail links and deep links could still resolve into `LegacyPortal` even though extracted modules now own the destination surface.

Examples:

- `details/customer/*`
- `details/account/*`
- `details/billing-account/*`
- `details/invoice/*`
- `details/order/*`
- `details/product/*`
- `details/product-pricing/*`

Fix:

- Added route normalization in `web-ui/src/App.jsx`.
- Added matching route normalization in `web-ui/src/SalesAppRouter.jsx`.
- Added Playwright route coverage for migrated detail routes.

### 2. Sales New Opportunity could fail without a raw AccountId

Problem:

The migrated Sales UI exposes a New Opportunity action, but the backend sales route required a raw AccountId. A normal user may not know this value, which made the action easy to break even though it previously existed in the UI.

Fix:

- Added `pricing-microservice/app/services/sales_compat.py`.
- Registered compatibility routes before the core sales router.
- The compatibility POST `/api/sales/opportunities` resolves account context from account/customer/name data or creates a lightweight placeholder account so the migrated UI action remains functional.

### 3. Lead conversion could fail for newly created leads with no CustomerNumber

Problem:

The API-backed lead conversion required a customer number. New leads created from the UI could lack one, making conversion fail even though the conversion action was visible.

Fix:

- Added compatibility POST `/api/sales/leads/{lead_id}/convert`.
- It resolves an existing account or creates a placeholder account when billing-customer context is not available.
- The lead still updates to Converted and creates the linked opportunity + conversion note.

### 4. Opportunity activity logging saved as generic notes

Problem:

The UI activity modal sent activity fields, but the backend defaulted opportunity notes to `General`. The Activity tab filters for `Activity`, so a logged activity could disappear from the Activity tab.

Fix:

- Added compatibility POST `/api/sales/opportunities/{opportunity_id}/notes`.
- It detects activity-shaped payloads and persists them with `NoteType = Activity`.
- It composes activity type, outcome, notes, and next step into the stored note.

### 5. Regression coverage needed to protect these fixes

Fix:

- Added backend route-order tests ensuring compatibility routes are registered before the core sales routes.
- Expanded Playwright route smoke coverage for migrated detail routes.

## Still not claimed as complete/perfect

This review fixed several real regressions and routing/API gaps, but it does not prove every possible user click and business edge case. The branch should still be described as strongly improved and better guarded, not perfect.

Remaining areas for a true exhaustive sign-off:

- Run GitHub Actions and confirm all new tests pass.
- Manually QA the Sales UI modals in staging.
- Add deeper E2E tests for actual lead-to-opportunity-to-quote-to-order-to-billing flow.
- Decide whether dashboard, knowledge, and customer-service should remain intentional LegacyPortal surfaces for this release.
- Complete a visual design QA pass across extracted modules.
