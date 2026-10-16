# Read-only live state — refreshed 16 October 2026

Subscription Azure subscription 1, a8f3fd5d-0d2f-4715-b685-728b21d1cc10; tenant 4e1db426-c797-4336-bd16-7e771a5de494. Azure/GitHub control-plane reads were refreshed on 16 October and their security settings, budgets, inventory and obsolete secret names were unchanged. The successful production SQL runtime read below was on 15 October; dev SQL remains unverified in this follow-up. No Azure configuration, role assignment, schema/data, secrets or branch protection changed. SQL reads may wake an auto-paused database.

| Item | Observed |
| --- | --- |
| Both portal ingresses | External HTTPS, allowInsecure=false, port 8000; minReplicas=0/maxReplicas=1 |
| Both Easy Auth configs | Enabled; tenant-specific v2 issuer; RedirectToLoginPage; only /health excluded; dedicated client IDs |
| Both Entra enterprise apps | appRoleAssignmentRequired=true |
| Budgets | Dev $10/prod $25, 80% and 100% actual plus 100% forecast email to owner; alerts, not caps |
| Dev SQL AZBDWUSDEV | GP_S_Gen5 serverless, useFreeLimit=true, exhaustion AutoPause, autoPauseDelay=60; observed paused before checks |
| Prod SQL grants (15 October) | id-bdwus-prod belongs to bdwus_portal; SELECT/INSERT/UPDATE/DELETE/EXECUTE on ai, billing, ms, ops, admin, billingops, care; SELECT on report/knowledge. No DDL grant in this role |
| Prod billing facts (15 October) | Subscriptions=0, Payments=0, UsageEvents=0 confirmed by runtime SQL read |
| Registry | Both bdwuscr and shared AXIOM registry exist, Basic, LegacyRegistryPermissions |
| Old SWA | bdwus-telecom in AZURE-SQL-PNG, eastus2, still exists |
| GitHub prod | Sole reviewer BrianDWalker, main-only branch policy; self-review allowed and admin bypass allowed |
| Deployment flag | BDWUS_DEPLOY_APPROVED=true |
| Main protection | PRs required, zero approving reviews required; stale reviews dismissed; force push/deletion disabled; admins not enforced; required_status_checks=null |
| Secrets | Five obsolete repository SWA/publish-profile secret names listed in owner-checklist.md; no dev/prod environment secrets. Values not retrieved |
| CI proposal | Portal checks run 38826458502 succeeded in 35 seconds; not required on main |

Control-plane reads used az containerapp show, authConfigs/current GET, az ad sp show, budget GET, az sql db show, registry/resource inventory and GitHub environment/secrets/protection APIs. Secret values were neither requested nor logged. Direct workstation SQL connections timed out; a production container runtime read succeeded and supplied current grants, prerequisite demo IDs and billing counts. A subsequent remote-exec attempt received a transient 404; dev runtime SQL verification and effective DDL denial require the read-only recheck below if the retry remains unavailable. Previous rollout on 13 October verified both identities SELECT=1, CREATE TABLE=0 and db_owner=0; this historical result is not presented as a fresh effective-permission check.

## Read-only recheck commands

```sh
az containerapp show -g rg-bdwus-dev -n ca-bdwus-dev --query properties.configuration.ingress --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az containerapp show -g rg-bdwus-prod -n ca-bdwus-prod --query properties.configuration.ingress --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
# Repeat for dev/prod; GET only:
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-dev/providers/Microsoft.App/containerApps/ca-bdwus-dev/authConfigs/current?api-version=2024-03-01' --query '{enabled:properties.platform.enabled,validation:properties.globalValidation,aad:properties.identityProviders.azureActiveDirectory.registration.clientId,issuer:properties.identityProviders.azureActiveDirectory.registration.openIdIssuer}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az ad sp show --id 4aaa3bab-43a3-4f4c-9f6c-ebfcfb88de97 --query appRoleAssignmentRequired --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az ad sp show --id 02880795-d949-4cc1-beac-47ec2e1b880c --query appRoleAssignmentRequired --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az sql db show -g AZURE-SQL-PNG -s bdwus -n AZBDWUSDEV --query '{free:useFreeLimit,behavior:freeLimitExhaustionBehavior,autoPause:autoPauseDelay,sku:sku}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-dev/providers/Microsoft.Consumption/budgets?api-version=2023-11-01' --query 'value[].properties.{amount:amount,notifications:notifications}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az rest --method GET --url 'https://management.azure.com/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-bdwus-prod/providers/Microsoft.Consumption/budgets?api-version=2023-11-01' --query 'value[].properties.{amount:amount,notifications:notifications}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az resource list --resource-type Microsoft.Web/staticSites --query '[].{name:name,id:id}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
az acr show -n bdwuscr --query '{id:id,sku:sku.name,mode:roleAssignmentMode}' --subscription a8f3fd5d-0d2f-4715-b685-728b21d1cc10
gh secret list --repo BrianDWalker/BDWUS
gh variable get BDWUS_DEPLOY_APPROVED --repo BrianDWalker/BDWUS
gh api repos/BrianDWalker/BDWUS/environments/prod --jq '{protection_rules,deployment_branch_policy,can_admins_bypass}'
gh api repos/BrianDWalker/BDWUS/branches/main/protection --jq '{required_status_checks,required_pull_request_reviews,enforce_admins}'
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
-- Expected new billing counts before any approved data load: all zero.
```

If scale-to-zero yields no exec target, open /health and inspect the latest running replica before retrying read-only exec. Do not change ingress, scale, firewall or authentication merely to run this check.
