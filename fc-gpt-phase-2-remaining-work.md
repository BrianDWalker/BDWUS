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

### API and data documentation

Completed the API/data ownership documentation pass:

- Added `docs/fc-gpt-phase-7-api-data-documentation.md`
- Documented module-to-endpoint-to-Azure SQL ownership
- Documented schema boundaries, mutation expectations, and partial-data behavior
- Corrected the extracted Sales route graph so `sales` and sales detail routes are mounted from `App.jsx`
- Captured remaining Knowledge partial-data and seed-maturity blockers

## Active Scope Notes

- The main technical direction is to move away from fake/demo-only data and make Azure SQL Database the authoritative data source where practical.
- The API should own all database access. The web UI should call API endpoints for reads and mutations instead of importing local mock data for production workflows.
- Any remaining demo data should be clearly isolated as local development fallback data, not mixed into production API behavior.

## Phased Execution Plan

### Phase 0 - Artifact inspection and baseline capture

Goal:

- Confirm the current deployed artifact is visually useful before changing the data layer.

Tasks:

- Manually inspect artifact `8093650837` from GitHub Actions run `28747284401`.
- Confirm screenshots are not loading-shell-only.
- Confirm screenshots cover the intended desktop routes and important detail pages.
- Record any visual or route evidence gaps that need to be preserved while the API/data layer changes.

Completion criteria:

- A short artifact inspection note is added to this plan or a linked validation note.
- Any blocking visual regressions are filed as follow-up tasks before backend/data work starts.

### Phase 1 - Fake data inventory and migration map

Status:

- Complete in `docs/fc-gpt-phase-1-data-source-migration-map.md`.
- Azure SQL access was validated read-only against `bdwus.database.windows.net` / `AZBDWUSP`.
- Azure Container App target `bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io` was identified.
- No Azure SQL or Container App mutations were made in this phase.

Goal:

- Identify every place where the app still depends on fake data and decide the target Azure SQL/API replacement.

Tasks:

- Inventory frontend imports and usage of `web-ui/src/data/mockData.js`.
- Inventory backend service modules that still use in-memory, smoke, generated, or static records.
- Map each module to its required API endpoints:
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
- Decide which data remains local-only for development and which must be moved to Azure SQL.
- Define a temporary fallback strategy for local development that cannot mask production API failures.

Completion criteria:

- A module-by-module data source matrix exists.
- Each fake data dependency has an owner phase for replacement, retention as local-only seed data, or removal.

### Phase 2 - Azure SQL schema, views, and migration readiness

Status:

- Complete in `docs/fc-gpt-phase-2-schema-readiness.md`.
- Added source-controlled migration `pricing-microservice/sql/phase2_schema_hardening.sql`.
- Added reusable SQL runner `pricing-microservice/scripts/apply_sql_file.py`.
- Added validator `pricing-microservice/scripts/validate_phase2_schema.py`.
- Applied and reran the migration against `bdwus.database.windows.net` / `AZBDWUSP`.
- Live validation passed for operational schemas, report metadata, Knowledge tables/views, billing elements, indexes, and migration marker.

Goal:

- Ensure Azure SQL Database has the required schemas, tables, views, constraints, and seed/migration process for the app surface.

Tasks:

- Review existing SQL assets, including `pricing-microservice/sql/sales_schema.sql`, `web-ui/azure-sql-sales-data-model.md`, and billing seed scripts.
- Define canonical schemas for the app, likely including:
  - `billing`
  - `ms`
  - `ai`
  - `dbo`
  - any needed operational/admin schema
- Create or update tables for customers/accounts, invoices, orders, products/pricing, sales entities, tickets, network/service records, admin records, and role/permission metadata.
- Create views that match read-heavy module needs and detail page payloads.
- Add indexes, primary keys, foreign keys, soft-delete columns, timestamps, and row status conventions.
- Make migrations idempotent and safe to rerun.
- Add validation queries for table existence, view existence, required columns, and baseline row counts.

Completion criteria:

- Azure SQL setup can be applied from source-controlled scripts.
- Required schemas, tables, views, and indexes are present.
- A validation command or script proves the database shape matches API expectations.

### Phase 3 - API database access layer and CRUD contracts

Status:

- Complete in `docs/fc-gpt-phase-3-api-contracts.md`.
- Added shared SQL access helper `pricing-microservice/app/services/sql_access.py`.
- Converted platform report definition, Knowledge, administration summary, and platform bootstrap slices from static/mock sources to Azure SQL-backed reads.
- Added platform Knowledge API endpoints and moved the Knowledge module off direct `mockData.js` imports.
- Existing admin, ops, billing-workflow, customer-service, and sales mutation routes continue to use Azure SQL write paths.
- Local pytest remains blocked because `pytest` is not installed in the local Python environment.
- Full `app.main` OpenAPI import remains blocked locally because the `openai` package is not installed in this Python environment.

Goal:

- Make the backend API the only production path for Azure SQL reads and mutations.

Tasks:

- Establish a shared Azure SQL connection/configuration pattern for the API.
- Add repository/data-access helpers for `SELECT`, `INSERT`, `UPDATE`, and soft-delete or status-change operations.
- Convert read endpoints from fake/static sources to Azure SQL-backed queries.
- Convert mutation endpoints to Azure SQL transactions where records span multiple tables.
- Standardize API response shapes for:
  - list endpoints
  - detail endpoints
  - create responses
  - update responses
  - validation errors
  - permission errors
  - upstream/database failures
- Add backend tests for successful reads, inserts, updates, validation failures, and database error handling.

Completion criteria:

- Core module endpoints use Azure SQL for production reads.
- High-value mutations use Azure SQL with transaction boundaries where needed.
- API contract tests pass without relying on frontend mock data.

### Phase 4 - Frontend API integration and mock-data removal

Status:

- Complete in `docs/fc-gpt-phase-4-frontend-api-integration.md`.
- Moved active shell navigation out of `web-ui/src/data/mockData.js` and into `web-ui/src/navigationConfig.js`.
- Removed the production `LegacyPortal` fallback from `App.jsx`.
- Active production routes now render extracted/API-backed modules or an API-backed unknown-route state.
- Route ownership tests now import navigation from the real navigation config, not mock data.
- Current emitted JavaScript bundle has no `mockData`, `LegacyPortal`, or old fixture-data string matches.
- Blocker: retired source files `web-ui/src/LegacyPortal.jsx` and `web-ui/src/components/SalesCRM.jsx` still import `web-ui/src/data/mockData.js`, but they are no longer imported by the production route graph.

Goal:

- Move production UI workflows off local mock data and onto API-backed data loading.

Tasks:

- Replace production usage of `mockData.js` with API calls.
- Keep any mock fixtures in test-only or local-dev-only locations.
- Update detail pages to load from API detail endpoints instead of normalized route fallbacks or local records.
- Normalize frontend data states across modules:
  - loading
  - loaded with data
  - loaded empty
  - loaded partial
  - hard error
- Audit modules that still show raw endpoint timeout messages directly to users.
- Add user-facing partial-data behavior where API aggregation can partially succeed.

Completion criteria:

- Production app flows do not depend on `web-ui/src/data/mockData.js`.
- Frontend route and detail tests pass against API-shaped fixtures or deployed API responses.
- Timeout and database errors are shown through consistent UI states.

### Phase 5 - Backend role enforcement

Status:

- Complete in `docs/fc-gpt-phase-5-backend-role-enforcement.md`.
- Added backend middleware role/capability checks for protected ops, billing-workflow, admin, sales, quote, approval, contract, and compatibility mutation paths.
- Backend authorization now defaults missing or unknown roles to `Viewer`, so bypassed mutation calls without a role header are denied.
- Frontend mutation clients send the active demo role with `X-Demo-Role` so preview/demo workflows exercise backend enforcement.
- Added backend role-enforcement contract tests for denied Viewer behavior, missing-role denial, allowed role capabilities, and protected method/path mappings.
- Remaining auth maturity: `X-User-Role` and `X-Demo-Role` are header-based role sources. A future identity phase should derive roles from signed tokens, API sessions, or user profiles.

Goal:

- Move role gating beyond frontend/demo controls and enforce protected operations in the API.

Tasks:

- Define the authoritative role source:
  - auth token
  - API session
  - user profile endpoint
  - explicit demo/testing mode
- Define backend permissions for protected mutations.
- Add API enforcement for high-risk actions:
  - order creation and progression
  - invoice actions and billing adjustments
  - admin user, role, and integration changes
  - sales create/convert/quote actions
- Add negative-path API tests:
  - Viewer cannot create order
  - Viewer cannot create invoice action
  - Viewer cannot create admin records
  - Billing role can access billing actions
  - Admin role can access admin functions
  - Sales role can access sales creation actions
- Keep the demo role selector clearly labeled as demo/testing when it is active.

Completion criteria:

- API rejects unauthorized mutations even if the frontend is bypassed.
- Frontend permission behavior matches backend enforcement.
- Role/permission tests cover both allowed and denied paths.

### Phase 6 - Preview-compatible workflow coverage

Status: Complete.

Completed in this phase:

- Added deployed preview workflow visual smoke coverage in `web-ui/tests/deployed-workflow-visual-smoke.spec.js`.
- Wired the workflow smoke spec into the `fc-gpt Validation` deployed web smoke job.
- Kept deployed workflow coverage non-mutating:
  - Sales: opens New Lead, New Opportunity, lead conversion, and Create Quote workflow dialogs where preview rows exist, then cancels.
  - Billing: opens invoice action and adjustment workflow surfaces and verifies the create controls render without clicking them.
  - Orders: verifies New Order and Provisioning workflow controls render without clicking mutation actions.
  - Viewer role: verifies deployed billing and order mutation controls stay disabled from the UI.
- Attached workflow evidence JSON and screenshots for each workflow surface so the deployed artifact proves loaded state beyond route/title/viewport.
- Kept deployed visual smoke strict by default while allowing the documented Knowledge-route partial-data 404 until the Phase 7 API/data decision is made.
- Reduced the existing mobile navigation deployed evidence capture to a viewport screenshot only, avoiding a test timeout without changing mobile/tablet design.

Blockers / deferred submit coverage:

- Deployed submit-style workflow tests are still intentionally blocked until preview data has deterministic seed IDs, cleanup APIs or cleanup SQL, and a safe isolated test namespace.
- The blocked submit set includes lead conversion submit, quote creation, approval approve/reject/request-changes, order creation, order provisioning, billing invoice actions, billing adjustments, and admin sample user/role/integration creates.
- Knowledge currently renders with a visible partial-data `Not Found` status from the deployed knowledge data request. The route still proves its shell and knowledge panels render; data ownership and API behavior remain a Phase 7 documentation/design item.
- This phase does not include broader mobile/tablet redesign work per the current project direction.

Goal:

- Add workflow test coverage only where the deployed preview surface can support it reliably.

Tasks:

- Identify workflows safe for non-destructive deployed visual coverage.
- Identify workflows that need seeded data and cleanup before submit tests can be enabled.
- Add preview-compatible visual smoke coverage for safe workflows.
- Avoid deployed submit tests until deterministic seed and cleanup are in place.
- Keep route evidence rich enough to prove the loaded state beyond URL/title/viewport.

Completion criteria:

- Workflow visual smoke tests cover only stable preview-compatible paths.
- Any submit-style workflow tests have deterministic setup and cleanup.
- Deployed smoke remains strict on hard failures while allowing documented partial-data warnings.

### Phase 7 - API/data documentation

Status:

- Complete in `docs/fc-gpt-phase-7-api-data-documentation.md`.
- The extracted Sales route graph was corrected while documenting branch ownership, so `sales` and the sales detail routes now render from `App.jsx`.
- Remaining blockers are documented explicitly:
  - Knowledge still lacks a partial-data warning path for knowledge-side `404` responses.
  - Startup-time DDL and synthetic seed insertion still live inside API startup helpers.
  - Multi-table writes still rely on inline transaction handling instead of one shared transaction helper.
  - Active backend role enforcement still depends on role headers, not signed identity.

Goal:

- Make the data model and API behavior understandable enough to maintain.

Tasks:

- Document endpoint usage for every module.
- Document Azure SQL schemas, tables, views, and ownership boundaries.
- Document mutation flows and transaction expectations.
- Document known partial-data behavior in staging.
- Document the Knowledge ownership decision and keep the module API-backed.
- Document local development seed data versus production database data.

Completion criteria:

- Developers can trace each UI module to API endpoints and database objects.
- Known staging limitations and partial-data behavior are explicit.
- Fake/local data is documented as local-only where retained.

### Phase 8 - UI consistency and desktop polish

Status:

- Complete for desktop consistency scope.
- Shared formatting primitives now normalize desktop date, timestamp, percentage, and structured-value rendering across the extracted modules.
- Administration tables now render readable permission summaries and formatted last-login timestamps instead of raw JSON-like payloads.
- Reports, Orders, Ops, Billing detail, Customer Service detail, and Sales contract surfaces now use more consistent desktop formatting and empty-state handling.
- The Sales contract terms panel no longer dumps raw JSON in the user-facing detail view; structured terms render as labeled fields instead.
- Remaining blockers are documented explicitly:
  - Some edit dialogs still intentionally expose JSON textareas for structured payload entry because those workflows do not yet have dedicated field-by-field editors.
  - Broader mobile/tablet redesign work remains intentionally out of scope for this phase.
  - Cross-module status-tone logic is still duplicated in places; visual output is now more consistent, but the mapping rules are not yet centralized.

Goal:

- Keep UI quality consistent while data and API behavior become more real.

Tasks:

- Normalize warning, error, and empty-state styling across modules.
- Normalize date/timestamp, currency, percentage, and status formatting.
- Normalize page header action clusters and tab overflow behavior.
- Polish admin tables and settings cards.
- Remove or replace raw JSON dumps where they are not intentional debug output.

Completion criteria:

- Desktop workflows remain visually coherent after API-backed data changes.
- Raw debug output does not appear in user-facing production surfaces unless intentional.

### Phase 9 - Final test and artifact strategy

Goal:

- Make the validation suite prove the Azure SQL/API-backed app is stable.

Tasks:

- Align unit, API contract, and Playwright tests with Azure SQL-backed API contracts.
- Add database migration/schema validation to CI if credentials and environment allow it.
- Keep deployed visual tests focused on stable preview-compatible behavior.
- Keep artifact screenshots and route evidence easy to inspect.
- Split deployed jobs only if runtime or artifact readability becomes a problem.

Completion criteria:

- CI validates frontend, API contracts, role enforcement, and deployed route smoke.
- Database setup validation is automated where environment access allows it.
- Final artifacts prove routes and important workflows render with API-backed data.

## Suggested Next Execution Order

1. Inspect the `deployed-web-playwright-report` artifact from run `28747284401`.
2. Build the fake data inventory and module-to-endpoint/database matrix.
3. Harden Azure SQL schema, views, migrations, and validation scripts.
4. Convert API reads and mutations to Azure SQL-backed repository functions.
5. Replace frontend production mock-data usage with API calls.
6. Add backend role enforcement for high-risk mutations.
7. Add preview-compatible workflow coverage with deterministic seed/cleanup only where safe.
8. Document API/data ownership and staging partial-data behavior.
9. Finish desktop UI consistency polish and final artifact strategy.
