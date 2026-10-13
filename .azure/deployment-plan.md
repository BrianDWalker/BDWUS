# BDWUS Azure deployment plan

Status: Ready for Validation — local checks complete; live deployment validation pending owner approval.

Prepared 12 October 2026 from the attached owner-approved seven-part scope. No provisioning, deployment, Azure configuration changes, SQL schema changes or seeding executed. Work is isolated in an attached worktree; original local UI edits remain untouched.

## Architecture and recipe

Modernize React 19/Vite + FastAPI using Bicep and azd. One Container App serves the UI and /api. Separate dev/prod resource groups, consumption environments/apps, user-assigned identities, Key Vault and App Insights. minReplicas=0, maxReplicas=1, 0.5 vCPU / 1 GiB. The old assistant remains source-only; portal routes already provide that function. AI is disabled until separately approved. Data API builder is unnecessary for the current business API.

Follow AXIOM's subscription entry point, resources modules and azd portal structure; AXIOM has no standalone shared template. Reference, never recreate, its registry and workspace by resource ID:

- Registry: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u
- Logs: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.OperationalInsights/workspaces/log-financial-advisor-8a42-vuti2u
- SQL server: /subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.Sql/servers/bdwus

Detected subscription Azure subscription 1 (`a8f3fd5d-0d2f-4715-b685-728b21d1cc10`), tenant `4e1db426-c797-4336-bd16-7e771a5de494`; proposed location East US, matching SQL and shared AXIOM resources. Owner confirms context before live execution.

## Resources and capacity

| Type | New across dev/prod | Evidence / limitation |
| --- | ---: | --- |
| Resource groups | 2 | Separate workload groups; no existing-resource deletion |
| Container Apps environments | 2 | East US usages API: current 1, limit 20; total 3 within limit |
| Container Apps | 2 | maxReplicas=1; runtime consumption capacity must be checked at provisioning |
| User-assigned managed identities | 2 runtime + 2 optional GitHub | Roles declared on vault/registry; creation remains pending |
| Key Vaults | 2 | Standard, RBAC, soft delete and purge protection; availability/name validation pending live preview |
| App Insights | 2 | Existing workspace; no shared workspace settings modified |
| SQL database | 1 dev only | Free offer allows 10 per subscription; prod already free. Exact eligibility validated during approved provision |
| Budgets | 2 | Defaults $10/$25, email 80%/100% actual and 100% forecast |
| Shared registry/workspace/prod SQL | 0 | Existing only |

`az quota list` was attempted first: Microsoft.Quota is not registered. Provider registration would mutate Azure, so it was not performed. Read-only fallback `az rest .../Microsoft.App/locations/eastus/usages?api-version=2024-03-01` verified environment count. Other live quota/policy/provisioning validation remains an explicit deployment gate, not an assumed pass.

## Security and data

Entra Easy Auth, assigned-user single-tenant registrations, Key Vault reference for entra-client-secret, managed identity for SQL/registry/vault. API rejects missing/wrong-tenant platform identity and derives roles from signed-in claims. Demo auth is local-only, using a random process secret. No wildcard CORS or SQL password fallback. Optional GitHub credential is github-token in the per-environment vault; no static Azure tokens.

Runtime roles: AcrPull scoped to the shared registry; Key Vault Secrets User scoped to the dedicated vault. SQL data-plane role grants are shown in grant_portal_access.sql; no DDL privileges. No automatic grant hook is included because the owner requires reviewing SQL first. No storage integration exists in the current seeder.

Prod AZBDWUSP is an existing Bicep resource only. Dev uses AZBDWUSDEV, AutoPause at its free allowance. A single guarded SQL runner reads an ordered manifest and refuses prod. Runtime assistant DDL was extracted into SQL. Production catalog connection timed out; production stored procedures/schema parity and proposed subscriptions/payment/usage contracts remain unresolved. Dev is not yet built or seeded.

## Approval stages

1. Review seven stacked draft PRs and SQL files. Confirm East US/subscription, alert email and Entra registrations.
2. Explicitly approve foundations: DEPLOY_PORTAL=false; create env/identity/vault/Insights/budget and dev SQL only.
3. Owner configures assignment-required Entra apps/roles and Key Vault entra-client-secret. Optional github-token stays disabled unless required.
4. Approve SQL reconciliation, dev migration and SQL grants separately. Restore approved read-only network connectivity first; never add firewall exceptions implicitly.
5. Approve image publishing and portal provision with DEPLOY_PORTAL=true. Configure callbacks and validate dev sign-in/authorization/data.
6. Configure GitHub dev/prod environments and OIDC deployment identities. Owner as sole required reviewer on prod; workflow checks the owner review policy before Azure login. Enable BDWUS_DEPLOY_APPROVED only after explicit approval.
7. Approve production cutover and later retirement of legacy resources. No deletion included.

See README for the exact review commands and docs/entra-owner-steps.md for secret and registration instructions.

## Validation proof

Local checks use the Azure validation skill; no provision preview or live deployment has been run.

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
| SQL read-only metadata | Entra/ODBC catalog connection | Timed out; no changes |
| Azure live validation | azd provision preview, policy, deployed identity/data tests | Not run; owner gate and missing configuration |

The plan must not be marked Validated/Deployed until remaining live gates pass.

## Estimated monthly costs

Low-traffic incremental dev $0–10; prod $0–25. Shared AXIOM baseline, retained old BDWUS resources, AI and egress excluded. September actual prod SQL $0 and existing BDWUS group approximately $5. Container Apps grants are shared per subscription; shared workspace ingestion is metered and may dominate costs. Budget alerts are not caps. See docs/azure-owner-review.md for actual cost evidence and sources.
