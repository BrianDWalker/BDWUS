# fc-gpt Phase 2 Remaining Work

This is the remaining work after commit `944884c` on `fc-gpt`.

## Current Proven State

- `fc-gpt Validation` passed on GitHub Actions run `28747284401`.
- `deployed web route smoke` passed in that run.
- The artifact name is still `deployed-web-playwright-report`.
- Artifact metadata exists for ID `8093650837`.
- Deployed detail visual smoke coverage now includes:
  - Ticket detail
  - Network event detail
  - Admin record detail
  - Sales lead detail
  - Sales opportunity detail
  - Sales quote detail
  - Sales contract detail
- Customer 360 and Product & Pricing now render partial-data warnings when one source times out but other useful data is available.
- Deployed Playwright is serialized with a preview settle wait to avoid racing Static Web Apps deployment and overloading staging APIs.

## Important Verification Gap

The final GitHub artifact screenshots were not manually inspected because unauthenticated artifact download was blocked in the local environment. The workflow uploaded `deployed-web-playwright-report`, but a signed-in reviewer should still inspect the artifact screenshots for visual usefulness.

## Workstream 1 - Phase 1 Artifact Stabilization

Remaining:

- Manually inspect artifact `8093650837` from run `28747284401`.
- Confirm screenshots are not loading-shell-only.
- Confirm screenshots cover:
  - All 14 desktop routes
  - Tablet routes
  - Mobile navigation
  - Global search
  - Sales tabs
  - Product & Pricing tabs
  - Billing tabs
  - Administration tabs
  - Sales New Lead modal
  - Sales New Opportunity modal
  - New detail screenshots added in Phase 2

## Workstream 2 - Detail Page Coverage and Implementation

Implemented and visually covered:

- Lead detail
- Opportunity detail
- Quote detail
- Contract detail
- Ticket detail
- Network event detail
- Admin record detail

Remaining true detail-page implementation:

- Customer/account detail
- Invoice detail
- Order detail
- Product detail

Current caveat:

- Routes such as `details/customer/*`, `details/invoice/*`, `details/order/*`, and `details/product/*` currently normalize back to top-level modules rather than rendering dedicated detail pages.

Recommended next steps:

- Add dedicated detail modules for customer/account, invoice, order, and product.
- Use a shared record-header pattern with breadcrumb, status, summary strip, main sections, related records, and mobile-safe layout.
- Add deployed visual tests that reach each detail page through a visible UI action where possible.
- Avoid claiming those four detail routes are complete until screenshots show actual dedicated detail content.

## Workstream 3 - Sales Readiness Hardening

Partially done:

- Deployed visual coverage now exercises sales tabs, create modals, and sales detail pages.

Remaining:

- Separate Sales states more explicitly:
  - loading
  - partial data loaded
  - empty but valid
  - API warning
  - hard error
- Add deployed visual coverage for:
  - Convert Lead modal when a convertable lead exists
  - Create Quote modal from a stable opportunity path
  - Custom Pricing review modal
  - Approval review modal
- Make `Sales sync status` consistent with the new shared warning treatment.
- Ensure skeleton loaders never remain visible after route-loaded assertions.

## Workstream 4 - Workflow Interactions

Remaining visual-only workflow coverage:

- Convert Lead
- Create Quote
- Quote-to-Order
- Create ticket
- New Order
- Progress order / Provision
- Create billing action
- Create billing adjustment
- Create admin user
- Create admin role
- Create admin integration
- Refresh actions
- Search/filter controls beyond current global search
- Role selector permission changes

Remaining implementation decisions:

- Decide which workflows are safe as deployed visual-only tests.
- Decide which workflows can safely mutate seeded staging data.
- Add cleanup or deterministic seed strategy before adding deployed submit tests.

## Workstream 5 - Mobile and Responsive Redesign

Remaining:

- Identify dense table modules that should become mobile cards:
  - Customer 360
  - Customer Service
  - Orders
  - Billing
  - Product & Pricing
  - Reports
  - Administration
  - Sales
- Create a reusable responsive table/card primitive or module-specific mobile cards.
- Reduce horizontal table scrolling on phone-sized screens.
- Improve mobile spacing for page headers, toolbars, tabs, and action clusters.
- Add mobile screenshots for:
  - Customer 360
  - Billing
  - Product & Pricing
  - Reports
  - Administration
  - Customer Service
  - Orders
  - Sales

## Workstream 6 - Navigation and Information Architecture

Remaining:

- Decide desktop navigation direction:
  - improved grouped top nav
  - dropdown or mega-menu groups
  - persistent left rail
- Implement module groupings:
  - Command: Home, Reports, Knowledge
  - Commercial: Sales, Orders, Product & Pricing
  - Customer: Customer 360, Customer Service, Billing
  - Network & Service: Network Events, Service Management, Provisioning
  - Finance: Carrier Settlement
  - Administration: Administration
- Improve mobile nav grouping and active group state.

## Workstream 7 - Role and Security Model

Current caveat:

- Role gating remains frontend/demo-level only.

Remaining:

- Define the authoritative role model.
- Decide whether roles come from auth token, API session, user profile endpoint, or mock/demo only.
- Add backend/API enforcement for protected mutations.
- Add negative-path tests:
  - Viewer cannot create order
  - Viewer cannot create invoice action
  - Viewer cannot create admin records
  - Billing role can access billing actions
  - Admin role can access admin functions
  - Sales role can access sales creation actions
- Make disabled/hidden action behavior consistent.
- Keep the demo role selector clearly labeled as demo/testing, not production auth.

## Workstream 8 - API/Data Maturity

Remaining:

- Document endpoint usage for every module:
  - Dashboard
  - Knowledge
  - Sales
  - Customer 360
  - Customer Service
  - Orders
  - Product & Pricing
  - Billing
  - Network Events
  - Service Management
  - Provisioning
  - Carrier Settlement
  - Reports
  - Administration
- Normalize data states across modules:
  - loading
  - loaded with data
  - loaded empty
  - loaded partial
  - hard error
- Audit modules that still show raw endpoint timeout messages directly to users.
- Decide whether Knowledge should become API-backed.
- Add explicit documentation for known partial-data behavior in staging.

## Workstream 9 - UI Consistency and Design Polish

Partially done:

- Added a shared `WarningBanner`.

Remaining:

- Normalize warning, error, and empty-state styling across all modules.
- Normalize date/timestamp formatting, especially admin last-login and activity dates.
- Normalize currency and percentage formatting.
- Normalize status tags and tones.
- Normalize page header action clusters.
- Normalize tab overflow and active-state behavior.
- Improve dense dashboard and right-side panel spacing.
- Polish admin tables and settings cards.
- Remove or replace raw JSON dumps where they are not intentional debug output.

## Workstream 10 - Test and Artifact Strategy

Done:

- Added `deployed-detail-visual-smoke.spec.js`.
- Kept screenshots and route evidence under the existing deployed Playwright report artifact.

Remaining:

- Add `deployed-workflow-visual-smoke.spec.js` or equivalent coverage for non-destructive workflow modals.
- Add `deployed-responsive-visual-smoke.spec.js` or extend current visual smoke coverage for mobile module views.
- Add route evidence fields for important loaded-state proof beyond URL/title/viewport/console errors.
- Keep deployed tests strict on hard failures while allowing documented partial-data warnings.
- Consider splitting deployed test jobs only if artifact readability or runtime becomes a problem.

## Suggested Next Execution Order

1. Inspect the `deployed-web-playwright-report` artifact from run `28747284401`.
2. Implement dedicated customer/account, invoice, order, and product detail pages.
3. Add deployed visual coverage for those four detail pages.
4. Add non-destructive workflow modal coverage.
5. Start mobile table-to-card improvements and screenshots.
6. Document module data sources and partial-data behavior.
7. Start backend role enforcement for high-risk mutations.

