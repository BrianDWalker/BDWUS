# Live state after approved follow-up — 16 October 2026

Audited subscription Azure subscription 1, a8f3fd5d-0d2f-4715-b685-728b21d1cc10; tenant 4e1db426-c797-4336-bd16-7e771a5de494. These observations follow the owner-approved changes. SQL checks used Entra authentication; token and secret values were never printed or saved.

| Item | Verified result |
| --- | --- |
| Dev/prod ingress | External HTTPS only, port 8000; min 0/max 1 replica |
| Dev/prod Easy Auth | Enabled, tenant-specific v2 issuer and dedicated client/audience, Microsoft sign-in redirect, only /health anonymous |
| Both enterprise apps | Assignment required = Yes; owner has Admin |
| GitHub production | Sole reviewer BrianDWalker; main only; existing self-review/admin-bypass settings preserved |
| Deploy identities | Resource-scoped BDWUS Portal Deployer on their app/environment/runtime identity; registry ARM Reader; conditional Writer for bdwus-portal on bdwuscr. No RG Contributor or AXIOM AcrPush |
| Runtime registry access | Conditional Reader for bdwus-portal; retained legacy environment has conditional Reader for pricing-microservice |
| Registries | bdwuscr Basic in ABAC mode; shared AXIOM registry remains LegacyRegistryPermissions |
| Budgets | Dev $10/prod $25; actual 80%/100% and forecast 100% owner email alerts; alerts do not cap spending |
| Dev SQL | GP_S_Gen5 serverless, free offer enabled, exhaustion AutoPause, autoPauseDelay 60; SKU/firewall unchanged |
| SQL runtime privileges | Both identities: SELECT=1, CREATE TABLE=0, db_owner=0; recursive role bdwus_portal only; no effective DDL/control/ownership rights at database, schema or object scope |
| Billing facts | In each database: Subscriptions=1, Payments=1, UsageEvents=2; exact approved rows; repeat no-op |
| Quote association | Nullable SourceQuoteId and unique filtered index present in both databases |
| Main protection | Portal checks required from GitHub Actions; PR policy retained, force-push/deletion disabled |
| CI | 977 API tests pass; ruff, eslint and Vite pass. Hosted runs remain under 3 minutes; 10 existing lint warnings are non-failing |
| Deployment flag | BDWUS_DEPLOY_APPROVED=true; dev auto, production manual plus owner review |
| Obsolete secrets/SWA | Five approved repository credentials removed; no environment secrets; bdwus-telecom deleted |
| Branch retirement | 13 approved merged branches deleted; 3 already absent; unique work retained |
| Assistant | GitHub commits disabled; optional AI remains offline |

Dev workflow: https://github.com/BrianDWalker/BDWUS/actions/runs/38940464250; production workflow: https://github.com/BrianDWalker/BDWUS/actions/runs/38940798495. Both succeeded using OIDC and the narrowed deploy roles. Public health and sign-in protection, loopback application authorization and SQL-backed reads were checked separately. Trusted platform headers in loopback diagnostics are test fixtures; public forged headers do not bypass Easy Auth. The owner reported successful dev sign-in; production interactive sign-in and tenant MFA-policy enforcement are not independently certified by this audit.

## Read-only recheck commands

```sh
# Entra directory commands are tenant-scoped and do not accept --subscription.
# Stop rather than query another signed-in directory.
test "$(az account show --query tenantId -o tsv)" = '4e1db426-c797-4336-bd16-7e771a5de494' || exit 1
az containerapp show -g rg-bdwus-dev -n ca-bdwus-dev --query properties.configuration.ingress --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az containerapp show -g rg-bdwus-prod -n ca-bdwus-prod --query properties.configuration.ingress --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
# Repeat for dev/prod; GET only:
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-dev/providers/Microsoft.App/containerApps/ca-bdwus-dev/authConfigs/current?api-version=2024-03-01' --query '{enabled:properties.platform.enabled,validation:properties.globalValidation,aad:properties.identityProviders.azureActiveDirectory.registration.clientId,issuer:properties.identityProviders.azureActiveDirectory.registration.openIdIssuer}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az ad sp show --id 4aaa3bab-43a3-4f4c-9f6c-ebfcfb88de97 --query appRoleAssignmentRequired
az ad sp show --id 02880795-d949-4cc1-beac-47ec2e1b880c --query appRoleAssignmentRequired
az sql db show -g AZURE-SQL-PNG -s bdwus -n AZBDWUSDEV --query '{free:useFreeLimit,behavior:freeLimitExhaustionBehavior,autoPause:autoPauseDelay,sku:sku}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-dev/providers/Microsoft.Consumption/budgets?api-version=2023-11-01' --query 'value[].properties.{amount:amount,notifications:notifications}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-prod/providers/Microsoft.Consumption/budgets?api-version=2023-11-01' --query 'value[].properties.{amount:amount,notifications:notifications}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az resource list --resource-type Microsoft.Web/staticSites --query '[].{name:name,id:id}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az acr show -n bdwuscr --query '{id:id,sku:sku.name,mode:roleAssignmentMode}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az acr show -n crfinancialadvisor8a42vuti2u --query '{id:id,sku:sku.name,mode:roleAssignmentMode}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
gh secret list --repo BrianDWalker/BDWUS
gh secret list --repo BrianDWalker/BDWUS --env dev
gh secret list --repo BrianDWalker/BDWUS --env prod
gh variable get BDWUS_DEPLOY_APPROVED --repo BrianDWalker/BDWUS
gh api repos/BrianDWalker/BDWUS/environments/prod --jq '{protection_rules,deployment_branch_policy,can_admins_bypass}'
gh api repos/BrianDWalker/BDWUS/branches/main/protection --jq '{required_status_checks,required_pull_request_reviews,enforce_admins,allow_force_pushes,allow_deletions}'
```

For SQL, execute the following SELECTs through the portal container's managed-identity connection (`from app.database import get_sql_connection; c=get_sql_connection()`), or use an Entra-authenticated SQL editor. Run in each DB; do not use a human administrator's effective privileges as proof of runtime privileges.

```sql
SELECT DB_NAME(), HAS_PERMS_BY_NAME('billing.Customers','OBJECT','SELECT') AS CanRead,
       HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS CanCreateTable,
       IS_ROLEMEMBER('db_owner') AS IsDbOwner;
-- Expected runtime: intended DB, 1, 0, 0.
-- These three values alone do not prove DDL denial. Check effective inherited rights too:
SELECT entity_name,permission_name FROM fn_my_permissions(NULL,'DATABASE')
WHERE permission_name LIKE 'CREATE %' OR permission_name LIKE 'ALTER%'
   OR permission_name IN ('CONTROL','TAKE OWNERSHIP','IMPERSONATE ANY USER');
SELECT name FROM sys.schemas
WHERE HAS_PERMS_BY_NAME(name,'SCHEMA','ALTER')=1
   OR HAS_PERMS_BY_NAME(name,'SCHEMA','CONTROL')=1
   OR HAS_PERMS_BY_NAME(name,'SCHEMA','TAKE OWNERSHIP')=1;
SELECT SCHEMA_NAME(schema_id),name FROM sys.objects WHERE is_ms_shipped=0 AND (
 HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(schema_id))+'.'+QUOTENAME(name),'OBJECT','ALTER')=1
 OR HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(schema_id))+'.'+QUOTENAME(name),'OBJECT','CONTROL')=1
 OR HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(schema_id))+'.'+QUOTENAME(name),'OBJECT','TAKE OWNERSHIP')=1);
-- Expected: no effective DDL/control/ownership rows in all three result sets.
WITH memberships AS (
 SELECT role_principal_id FROM sys.database_role_members WHERE member_principal_id=USER_ID()
 UNION ALL SELECT m.role_principal_id FROM sys.database_role_members m
 JOIN memberships r ON m.member_principal_id=r.role_principal_id
) SELECT DISTINCT USER_NAME(role_principal_id) FROM memberships;
-- Inspect all recursively inherited memberships, not just grants directly on bdwus_portal.

SELECT u.name, r.name FROM sys.database_role_members m
JOIN sys.database_principals u ON u.principal_id=m.member_principal_id
JOIN sys.database_principals r ON r.principal_id=m.role_principal_id
WHERE u.name LIKE 'id-bdwus%';
SELECT p.state_desc,p.permission_name,SCHEMA_NAME(p.major_id) AS schema_name
FROM sys.database_permissions p JOIN sys.database_principals r ON r.principal_id=p.grantee_principal_id
WHERE r.name='bdwus_portal';
SELECT 'Subscriptions',COUNT(*) FROM billing.Subscriptions
UNION ALL SELECT 'Payments',COUNT(*) FROM billing.Payments
UNION ALL SELECT 'UsageEvents',COUNT(*) FROM billing.UsageEvents;
-- Expected approved demo billing counts after the load: Subscriptions=1, Payments=1, UsageEvents=2.
```

If scale-to-zero yields no exec target, open /health and inspect the latest running replica before retrying read-only exec. Do not change ingress, scale, firewall or authentication merely to run this check.
