# BDWUS Azure deployment plan

Status: Deployed — approved security follow-up complete in dev/prod; initial owner sign-in confirmed successful.

Prepared 12 October 2026 from the attached owner-approved seven-part scope. Owner explicitly approved all prepared changes on 12 October 2026. Foundation provisioning and approved SQL changes are complete. The existing production database, shared AXIOM resources and legacy hosting resources are retained. Work is isolated in an attached worktree; original local UI edits remain untouched.

## Architecture and recipe

Modernize React 19/Vite + FastAPI using Bicep and azd. One Container App serves the UI and /api. Separate dev/prod resource groups, consumption environments/apps, user-assigned identities, Key Vault and App Insights. minReplicas=0, maxReplicas=1, 0.5 vCPU / 1 GiB. The unused separate assistant-service is removed in the follow-up; portal assistant routes remain in the FastAPI app. AI is disabled until separately approved. Data API builder is unnecessary for the current business API.

Follow AXIOM's subscription entry point, resources modules and azd portal structure; AXIOM has no standalone shared template. Reference, never recreate, its registry and workspace by resource ID:

- Registry: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u
- Logs: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.OperationalInsights/workspaces/log-financial-advisor-8a42-vuti2u
- SQL server: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.Sql/servers/bdwus

Detected subscription Azure subscription 1 (`a8f3fd5d-0d2f-4715-b685-728b21d1cc10`), tenant `4e1db426-c797-4336-bd16-7e771a5de494`; proposed location East US, matching SQL and shared AXIOM resources. Owner approved this context on 12 October 2026.

## Resources and capacity

| Type | New across dev/prod | Evidence / limitation |
| --- | ---: | --- |
| Resource groups | 2 | Separate workload groups; no existing-resource deletion |
| Container Apps environments | 2 | East US usages API: current 1, limit 20; total 3 within limit |
| Container Apps | 2 | maxReplicas=1; created and running; consumption replicas verified |
| User-assigned managed identities | 2 runtime + 2 GitHub | Roles declared on vault/registry; created and verified |
| Key Vaults | 2 | Standard, RBAC, soft delete and purge protection; created and verified |
| App Insights | 2 | Existing workspace; no shared workspace settings modified |
| SQL database | 1 dev only | Free offer allows 10 per subscription; prod already free. Exact eligibility validated during approved provision |
| Budgets | 2 | Defaults $10/$25, email 80%/100% actual and 100% forecast |
| Shared registry/workspace/prod SQL | 0 | Existing only |

`az quota list` was attempted first: Microsoft.Quota is not registered. Provider registration would mutate Azure, so it was not performed. Read-only fallback `az rest .../Microsoft.App/locations/eastus/usages?api-version=2024-03-01` verified environment count. Subsequent foundation and app previews/provisioning succeeded, establishing available capacity for this rollout.

## Security and data

Entra Easy Auth, assigned-user single-tenant registrations, Key Vault reference for entra-client-secret, managed identity for SQL/registry/vault. API rejects missing/wrong-tenant platform identity and derives roles from signed-in claims. Demo auth is local-only, using a random process secret. No wildcard CORS or SQL password fallback. Optional GitHub credential is github-token in the per-environment vault; no static Azure tokens.

Runtime roles: AcrPull scoped to the shared registry; Key Vault Secrets User scoped to the dedicated vault. SQL data-plane role grants are shown in grant_portal_access.sql; no DDL privileges. No automatic grant hook is included because the owner requires reviewing SQL first. No storage integration exists in the current seeder.

Prod AZBDWUSP is an existing Bicep resource only. Dev uses AZBDWUSDEV, AutoPause at its free allowance. A single guarded SQL runner reads an ordered manifest and refuses prod. Runtime assistant DDL was extracted into SQL. The production database resumed and its actual catalog was captured as production_baseline.sql: 52 tables and 12 views, no stored procedures/functions. The guarded runner built dev and the dev-only seeder populated sample records. The approved additive billing migration and runtime grants were applied separately to both databases, bringing each to 55 tables. No existing production records were changed.

## Execution stages

Owner's blanket approval covers the prepared stages; no repeated approval is needed.

1. Seven PRs plus SQL reconciliation merged into fc-gpt; release and bootstrap hardening merged into main.
2. Dev/prod foundation deployments succeeded. Dev database free/AutoPause confirmed. No legacy resources deleted.
3. Assignment-required, single-tenant sign-in registrations, owner Admin assignments and dedicated Key Vault credentials configured.
4. Actual production schema captured; dev built/seeded; approved additive billing SQL and least-privilege grants executed. Existing firewall rules/tier unchanged.
5. Reviewed image published. Runtime AcrPull assignments confirmed after foundation completion. Initial apps stay private until Easy Auth is verified; enable public ingress in a separate provision stage.
6. GitHub environments/main restrictions, owner-only production review policy and OIDC identities/variables configured. Activated after live app validation; dev OIDC deployment succeeded and prod uses the required owner review.
7. Production rollout follows dev validation. Legacy resource retirement is outside this change and remains an owner decision.

See README for deployment commands and docs/entra-owner-steps.md for ongoing registration/secret maintenance.

## Validation proof

Local checks, live provisioning previews and deployments completed under the owner approval.

| Check | Command / evidence | Result |
| --- | --- | --- |
| Bicep compile | az bicep build on infra/main.bicep and infra/github-deploy/main.bicep | Pass |
| YAML syntax | yaml.BaseLoader on azure.yaml, workflows, Dependabot and pre-commit | Pass |
| Python lint | ruff check pricing-microservice assistant-service scripts | Pass |
| Pricing/API tests | python -m pytest -q | 47 passed; live credentials/connections forbidden |
| Legacy assistant tests | python -m pytest tests -q -o pythonpath=. | 3 passed |
| ESLint | npm --prefix web-ui run lint | No errors; 10 existing hook warnings |
| UI build | npm --prefix web-ui run build | Pass |
| npm audit | npm audit fix / audit | Zero known vulnerabilities after compatible updates |
| Secret scan | gitleaks dir --redact --no-banner | No leaks |
| Image build | docker build --platform linux/amd64 -t bdwus-portal:review . | Pass |
| Container smoke | network disabled; nonroot, ODBC, health, identity, SPA/404/traversal | Pass |
| Billing UI | playwright test tests/billing-facts.spec.js | Pass: loading, real rows, empty, error/retry |
| SQL catalog and API data | Captured schema, built dev, 8 API reads each environment | Pass after prod resumed; existing production data retained |
| Azure live validation | Foundation and dev portal previews/package | Pass; foundations, private bootstrap and public ingress provisioned |

The owner confirmed successful initial Microsoft sign-in. The security follow-up remains preparation-only and requires specific approval before any new Azure changes.

## Estimated monthly costs

Low-traffic incremental dev $0–10; prod $0–25. Shared AXIOM baseline, retained old BDWUS resources, AI and egress excluded. September actual prod SQL $0 and existing BDWUS group approximately $5. Container Apps grants are shared per subscription; shared workspace ingestion is metered and may dominate costs. Budget alerts are not caps. See docs/azure-owner-review.md for actual cost evidence and sources.

## Execution log — 12 October 2026

Owner approval covers the documented subscription, East US location, budget email brian.d.walker@bdwus.com and all seven stages. No repeated approval is needed. Subscription Owner permission confirmed; no dev/prod resource-group conflicts. Inherited policy SecurityCenterBuiltIn is audit/security configuration, not an applicable provisioning deny. Dev azd provision --preview passed (19 seconds), azd package passed (5 seconds), and earlier local checks remain valid. Production SQL is Resuming following read-only connection; its existing firewall rules are unchanged. Foundation uses DEPLOY_PORTAL=false; placeholder client identifier is unused until real per-environment registrations are configured.

Prod foundation preview passed (20 seconds); dev portal preview passed (19 seconds). Dev SQL free/AutoPause confirmed Online; baseline and approved additive migration applied successfully. Production catalog captured: 52 tables, 12 views, no procedures/functions; approved additive tables/views and least-privilege grants applied to prod, retaining existing data. Both databases now have 55 tables. Dev explicitly seeded; 47 tests and gitleaks passed afterward. Separate assigned-user Entra apps, owner Admin assignments, per-vault sign-in credentials, GitHub environments/main restrictions and OIDC identities configured. Secrets went directly from Graph memory to Key Vault and were never printed or saved in environment files.

Additional execution evidence: dev/prod each passed eight live SQL-backed API reads. SQL impersonation confirmed SELECT/UPDATE permissions and denied CREATE TABLE/db_owner. $10/$25 budgets and owner email verified. Old deployment workflows disabled, seven PRs plus schema reconciliation merged into fc-gpt and release PR #14 merged into main. Main branch protection and owner-only prod environment protection verified. All five pre-commit hooks passed; 8 permissions/billing browser checks passed after guarding Node import.meta.env. UI bundle SHA-256 matches the published image byte-for-byte. Initial portal creation is private until enabled Easy Auth is verified, then public ingress is a separate provision stage.

## Resumed execution — 13 October 2026

Both long-running foundation deployments and Container Apps environments reached Succeeded. Runtime AcrPull assignments are present. Automatic App Insights alerts were repaired after registering Microsoft.AlertsManagement. Dev azd foundation completion restored saved initial settings; these were detected before app creation and corrected to the actual Entra client ID, DEPLOY_PORTAL=true and PORTAL_PUBLIC_INGRESS=false. Fresh dev private-app preview passed (20 seconds), and production private-app preview passed (18 seconds).

Dev and production private bootstrap and public ingress deployments succeeded. Easy Auth tenant/client/audience settings were verified before public ingress. Both managed identities read the correct SQL database and billing views, with SELECT=1, CREATE TABLE=0 and db_owner=0. Production SQL resumed from auto-pause on retry. Dev runtime HTTP checks passed: Admin identity, wrong-tenant 401, Viewer mutation 403, SPA 200 and eight SQL-backed APIs 200. These loopback diagnostics exercise application behavior; they do not replace an actual owner browser sign-in. Public browser navigation reached Microsoft sign-in; the owner subsequently confirmed successful sign-in. Fresh browser-style unauthenticated and forged-header requests redirect to sign-in. Non-browser clients can receive the platform Bearer challenge (401).

Production runtime HTTP checks also passed Admin/wrong-tenant/Viewer authorization, SPA and all eight SQL-backed API reads. Production public /health is 200; portal/API browser requests, including forged platform identity headers, return Microsoft sign-in redirects. GitHub dev workflow [38395456218](https://github.com/BrianDWalker/BDWUS/actions/runs/38395456218) succeeded through OIDC login, shared-registry build/push and Container App update. Production workflow [38395679316](https://github.com/BrianDWalker/BDWUS/actions/runs/38395679316) also succeeded: owner review recorded using the authenticated owner account under the explicit chat approval, reviewer-policy verification, OIDC login, image push and app update. Both environments run image tag `8314bd8dd001d33938e14b50b86d4d28cd90aff6`. Dev runtime API checks passed again after the GitHub rollout.

## Follow-up preparation — 14 October 2026

Status: Preparation authorized; Azure changes and deployment NOT authorized.

Owner requests security-first follow-up PRs: deny-by-default route/actor authorization, assistant boundaries/idempotency, quote conversion and modal fixes, deployment identity Bicep proposals, legacy/docs/SEO cleanup, a lean CI proposal, explicit production demo-data proposal, branch audit and read-only live inventory. Every PR requires Codex review; findings must be fixed or answered before merge. App PR merges would trigger Azure dev deployment, so keep PRs open until the owner approves a specific Azure change list. No Azure mutations, branch deletions, production data changes or branch-protection activation in this follow-up.

## Follow-up status — 15 October 2026

The owner reported “it worked” for initial interactive sign-in. Legacy assistant-service source and stale handoff notes are removed in the cleanup PR. The portal assistant is retained in pricing-microservice. Security follow-up PRs and infrastructure/data proposals are not merged or deployed: no Azure changes, Azure resource or branch deletions, production data load, or branch-protection activation are authorized in this follow-up.


## Follow-up completed — 16 October 2026

Owner approval covered the specific follow-up checklist. Targeted Bicep validation and dev/prod previews passed; no resources were re-created. Existing bdwuscr is retained in ABAC mode, with conditional Writer for each GitHub identity, conditional Reader for each runtime identity, and preserved pricing-microservice Reader for the old environment identity. AXIOM registry settings remain unchanged. Both old RG Contributor and shared-registry AcrPush deployment grants are removed. Live dev and prod OIDC deployments succeeded using the narrower roles.

Both databases received the approved nullable SourceQuoteId column and unique filtered index. Exact checksum-pinned billing manifests inserted one subscription, one demo payment and two usage events per database; dev ran first and repeat runs were no-ops. Existing invoices were not changed. Effective permission checks show SELECT=1, CREATE TABLE=0, db_owner=0, no inherited database/schema/object DDL/control/ownership permissions, and only the bdwus_portal application role in both databases.

The required Portal checks job is active on main, with 977 passing API tests, lint and Vite build. Codex reviewed all PRs; findings were fixed or answered before merging. Thirteen approved merged branches were deleted; three other listed candidates were already absent. Unique-work branches remain. The obsolete SWA and five named old repository credentials are removed; old Container App/environment/logging remain. AI GitHub writes remain disabled.

Dev deployment: https://github.com/BrianDWalker/BDWUS/actions/runs/38940464250; production deployment: https://github.com/BrianDWalker/BDWUS/actions/runs/38940798495. Final image tag: 4ac8f8354b913bc80204ba82d26ca1e82a8bc384. See docs/live-state-review.md for current observations.
