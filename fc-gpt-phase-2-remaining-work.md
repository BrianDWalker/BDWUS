# fc-gpt Phase 2 Remaining Work

This plan started as the remaining work after commit `944884c` on `fc-gpt`. It now records what has been completed and what still remains.

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

## Completed Since This Plan Was Opened

### Detail page implementation

Completed dedicated detail pages and click-throughs for:

- Customer/account
- Invoice
- Order
- Product/pricing

These routes now render dedicated detail modules instead of falling back to generic record dumps.

### Sales workflow hardening

Completed the sales workflow coverage and state-handling pass for:

- Lead creation
- Lead conversion
- Opportunity creation
- Quote creation
- Billing actions and adjustments
- Admin mutations

### Navigation and responsive UI

Completed the desktop-first navigation and responsive polish pass:

- Grouped mobile navigation
- Active workspace group display
- Mobile card-style table rendering
- Shared shell role context for demo/testing roles

### Role and permission coverage

Completed the demo role hardening pass:

- Added a `Viewer` role
- Wired live demo role updates through permission checks
- Expanded negative-path permission coverage

### Test coverage and smoke alignment

Completed the route-evidence and smoke-alignment pass:

- Added richer route evidence to deployed visual smoke runs
- Corrected the dashboard route expectation to match the actual app heading
- Added visual smoke coverage for the new detail pages
- Removed a workflow smoke spec that did not match the static preview surface in this environment

## What Remains

### Workstream 1 - Artifact inspection

Remaining:

- Manually inspect artifact `8093650837` from run `28747284401`.
- Confirm screenshots are not loading-shell-only.
- Confirm screenshots cover the intended desktop routes and the important detail pages.

### Workstream 4 - Workflow interactions

Remaining:

- Add non-destructive workflow visual coverage only where it fits the deployed preview surface.
- Decide which workflows are safe as visual-only tests versus seeded submit tests.
- Add cleanup or deterministic seed strategy before adding deployed submit tests.

### Workstream 5 - Mobile and responsive redesign

Remaining:

- Finish the broader mobile/tablet redesign for the dense modules that still need it.
- Reduce horizontal scrolling on smaller screens where it still exists.
- Add the remaining mobile screenshots if the preview surface supports them cleanly.

### Workstream 7 - Role and security model

Remaining:

- Define the authoritative role model.
- Decide whether roles come from auth token, API session, user profile endpoint, or mock/demo only.
- Add backend/API enforcement for protected mutations.

### Workstream 8 - API/data maturity

Remaining:

- Document endpoint usage for every module.
- Normalize data states across modules.
- Audit modules that still show raw endpoint timeout messages directly to users.
- Decide whether Knowledge should become API-backed.
- Add explicit documentation for known partial-data behavior in staging.

### Workstream 9 - UI consistency and design polish

Remaining:

- Normalize warning, error, and empty-state styling across modules.
- Normalize date/timestamp, currency, percentage, and status formatting.
- Normalize page header action clusters and tab overflow behavior.
- Polish admin tables and settings cards.
- Remove or replace raw JSON dumps where they are not intentional debug output.

### Workstream 10 - Test and artifact strategy

Remaining:

- Add a workflow visual smoke suite only if it matches the real preview surface.
- Add responsive visual smoke coverage only where the preview surface can validate it reliably.
- Keep deployed tests strict on hard failures while allowing documented partial-data warnings.

## Suggested Next Execution Order

1. Inspect the `deployed-web-playwright-report` artifact from run `28747284401`.
2. Finish any remaining non-destructive workflow coverage.
3. Continue the broader mobile/tablet redesign only if the preview surface can verify it cleanly.
4. Document module data sources and partial-data behavior.
5. Start backend role enforcement for high-risk mutations.
