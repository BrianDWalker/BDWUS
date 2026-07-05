# fc-gpt Release Readiness Checklist

This checklist captures the next validation layer for the `fc-gpt` branch after the platform/API/module extraction work.

## Current release posture

The branch is substantially implemented and strongly validated through build, compile, route smoke, runtime smoke, staging smoke, and deployed web smoke coverage. It should not yet be described as exhaustively proven across every business workflow, mutation path, UI edge case, or data-shape variant.

## 1. App shell and LegacyPortal audit

### Current state

`web-ui/src/App.jsx` now acts as a route shell. The following routes are directly handled by extracted modules:

- `reports`
- `administration`
- `product-pricing`
- `customer-360`
- `billing`
- `orders`
- `network`
- `service-management`
- `provisioning`
- `carrier-settlement`

All other routes still fall through to `LegacyPortal`.

### Remaining meaningful legacy surfaces

The meaningful user-facing fallback areas that should be reviewed before release are:

- `dashboard` / Home operating brief
- `knowledge`
- `sales`
- `customer-service`
- detail routes that still rely on legacy rendering, especially:
  - `details/lead/*`
  - `details/opportunity/*`
  - `details/quote/*`
  - `details/record/*`
  - any detail route not owned by an extracted module

### Release gate

Before claiming the legacy migration is complete:

- [ ] Confirm every top-nav route is either extracted or intentionally marked legacy.
- [ ] Create a short owner/status row for each remaining fallback route.
- [ ] Do not add new feature behavior to `LegacyPortal` unless it is a temporary compatibility shim.
- [ ] Extract `sales` before claiming lead-to-cash UI is fully API-backed.
- [ ] Extract or retire `customer-service` before claiming customer support workflows are fully API-backed.
- [ ] Decide whether `dashboard` and `knowledge` are release-critical or acceptable legacy surfaces for this phase.

## 2. Full business-flow validation checklist

Smoke tests prove route availability. The next layer must prove cross-module workflow behavior.

### Lead to cash

- [ ] Create or load lead.
- [ ] Convert lead to opportunity.
- [ ] Create quote from opportunity.
- [ ] Submit quote for approval.
- [ ] Approve/reject quote and verify status display.
- [ ] Convert quote/opportunity to order.
- [ ] Verify the created order appears in Orders.
- [ ] Move order into provisioning.
- [ ] Verify provisioning job appears in Service Operations / Provisioning.
- [ ] Verify customer/account context remains visible in Customer 360.
- [ ] Verify invoice/billing workflow can reference the downstream operational context.

### Order to service operations

- [ ] Create order through UI.
- [ ] Validate API payload fields: account, service, lifecycle stage, overall status, SLA status.
- [ ] Progress order to provisioning.
- [ ] Validate `PUT /api/ops/orders/{orderId}` is called with provisioning state.
- [ ] Validate `POST /api/ops/provisioning-jobs` is called with the order ID.
- [ ] Refresh Orders and confirm both order and job lists update.
- [ ] Navigate to `network`, `service-management`, `provisioning`, and `carrier-settlement` and confirm consistent service-ops read models.

### Billing workflows

- [ ] Load invoices.
- [ ] Select invoice and load detail.
- [ ] Load invoice actions.
- [ ] Create invoice action.
- [ ] Validate `POST /api/billing-workflows/invoices/{invoiceId}/actions` payload.
- [ ] Create adjustment.
- [ ] Validate `POST /api/billing-workflows/adjustments` payload.
- [ ] Refresh and confirm action/adjustment rows remain visible.

### Admin workflows

- [ ] Load administration summary.
- [ ] Load users, roles, and integrations.
- [ ] Create sample user.
- [ ] Create sample role.
- [ ] Create sample integration.
- [ ] Verify records refresh after each mutation.
- [ ] Confirm settings/audit tabs do not depend on missing API fields.

## 3. Playwright coverage plan

Existing route smoke should remain. Add these deeper suites:

- `business-flow-mutations.spec.js`
  - Orders create/provision mutation path.
  - Billing action/adjustment mutation path.
  - Administration user/role/integration mutation path.
- `legacy-route-inventory.spec.js`
  - Documents which routes intentionally fall back to legacy.
  - Fails when a top-nav route unexpectedly renders blank or loses shell navigation.
- `sales-lead-to-cash.spec.js`
  - Start as a legacy-surface test while Sales is still in `LegacyPortal`.
  - Promote to API-backed E2E once Sales is extracted.

## 4. UI consistency QA checklist

Run a visual/product pass across every extracted module.

### Shell and navigation

- [ ] Active route state is correct for each extracted route.
- [ ] Utility popovers route to the expected module.
- [ ] Search results route correctly.
- [ ] Mobile drawer route behavior still works.

### Page headers and actions

- [ ] Every extracted module has a clear title, description, and primary action area.
- [ ] Primary actions use `.button` consistently.
- [ ] Secondary actions use `.ghost-button` or compact link styling consistently.
- [ ] Refresh actions are consistently named and positioned.

### Tables and panels

- [ ] Table density is consistent across Reports, Admin, Product Pricing, Customer 360, Billing, Orders, and ServiceOps.
- [ ] Empty states are phrased as actionable system states, not developer-only messages.
- [ ] Loading states use the same tone and placement.
- [ ] Error states do not expose raw stack traces or confusing backend text.

### Mutation UX

- [ ] Buttons disable while saving.
- [ ] Successful mutations show a toast.
- [ ] Failed mutations show visible error state.
- [ ] Data refreshes after every mutation.
- [ ] Repeated clicks do not duplicate requests unexpectedly.

## 5. Staging payload and field-mapping review

For each extracted module, compare staging payloads to UI field reads.

### Product & Pricing

- [ ] `/api/platform/product-pricing/overview`
- [ ] sales catalog/product endpoints used by the module
- [ ] promotions/offers/rate plan fields
- [ ] billing hierarchy fields

### Customer 360

- [ ] `/api/platform/customer-360/{customerNumber}`
- [ ] commercial records
- [ ] locations
- [ ] accounts
- [ ] opportunities
- [ ] quotes
- [ ] contracts

### Billing

- [ ] `/api/billing/customers`
- [ ] `/api/billing-workflows/invoices`
- [ ] `/api/billing-workflows/invoices/{invoiceId}`
- [ ] `/api/billing-workflows/invoices/{invoiceId}/actions`
- [ ] `/api/billing-workflows/adjustments`

### Orders and ServiceOps

- [ ] `/api/ops/bootstrap`
- [ ] `/api/ops/orders`
- [ ] `/api/ops/network-events`
- [ ] `/api/ops/provisioning-jobs`
- [ ] `/api/ops/carrier-settlement`

### Administration

- [ ] `/api/platform/administration/summary`
- [ ] `/api/admin/users`
- [ ] `/api/admin/roles`
- [ ] `/api/admin/integrations`

## 6. Release decision rubric

### Ready for internal/staging demo when

- [ ] Existing CI remains green.
- [ ] Runtime and staging smoke remain green.
- [ ] Business-flow mutation Playwright tests pass.
- [ ] Backend write-contract tests pass.
- [ ] Known legacy fallbacks are documented.
- [ ] No critical route renders blank.
- [ ] No critical mutation silently fails.

### Ready for broader release when

- [ ] Lead-to-cash flow has deeper E2E validation.
- [ ] Order-to-provisioning-to-billing flow has deeper E2E validation.
- [ ] UI consistency QA is complete.
- [ ] Staging payload shape review is complete.
- [ ] Any remaining legacy route has an explicit release decision: migrate, accept, or remove.

## 7. Current truthful summary

The branch is in a strong release-candidate direction, but the final release claim should be: `substantially implemented, modularized, API-backed, and strongly smoke/runtime/staging validated` until the deeper workflow and UI QA gates above are complete.
