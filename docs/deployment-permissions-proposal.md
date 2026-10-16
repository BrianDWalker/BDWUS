# Deployment permission proposal — owner approval required

No live roles or registry settings changed. Both deployment identities still have Contributor on their own resource group and AcrPush across the AXIOM registry; the exact removal candidates are below.

## Recommended decision

Retain/reuse existing Basic `bdwuscr` as a BDWUS-only registry after confirming no other workload uses it. Its observed September cost was about $5/month already paid; retaining it adds no second registry bill. Alternatively create one new shared dev/prod BDWUS-only Basic registry with dedicated-registry-proposal.bicep: plan approximately $5/month plus excess storage/egress. Do not create one registry per environment. This avoids altering AXIOM's registry authorization mode. Both existing registries currently use LegacyRegistryPermissions. Reusing `bdwuscr` with this template ALSO requires an owner-approved ABAC mode migration after inventorying all its consumers; the new-registry template starts in ABAC mode. Either path needs owner approval, image copying, new runtime pull assignments, app image/registry updates, GitHub environment variable updates and deployment validation before revoking old access. Reusing `bdwuscr` means it is no longer a deletion candidate.

## Shared registry ABAC alternative

Repository-scoped Entra permissions are supported but require ABAC mode. The current shared registry uses LegacyRegistryPermissions. Switching modes invalidates legacy AcrPull/AcrPush assignments, including AXIOM's. The prepared identity template grants Repository Writer only for `bdwus-portal`, plus Repository Reader for BDWUS runtime identities; it does not flip the shared registry mode or grant catalog listing. Before using it against the shared registry, inventory/migrate every AXIOM principal and ACR task, approve that separate coordinated plan, then validate BDWUS writes and AXIOM pulls. A condition alone does not restrict the old AcrPush grant: remove old grants only after replacement checks pass.

Source: [Microsoft ABAC migration and conditions](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions).

## Portal deployment permissions

Replace RG Contributor with a custom BDWUS Portal Deployer role assigned only to the existing Container App, managed environment and runtime identity. On these scopes it can read/update the app, read revisions/environment/identity and assign that one identity. The current `az containerapp update` implementation also reads existing app secrets, so listSecrets is explicitly included; removing it requires a separately reviewed REST deployment implementation. It cannot manage SQL, vaults, budgets, other resource-group resources, RBAC or delete the app.

Azure RBAC cannot restrict containerApps/write to the image field: an identity that updates the app can change its configuration or run code as its runtime identity. The remaining trust boundary is the protected main branch and production environment approval. This is narrower than Contributor, not image-only security. Compile passed; live least-privilege deployment validation awaits approval. Incremental Bicep does NOT remove prior grants.

## Specific old assignments to remove AFTER approval and replacement validation

- dev Contributor: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourcegroups/rg-bdwus-dev/providers/Microsoft.Authorization/roleAssignments/6a7f1123-1a05-548f-b3ec-9efaff56af60`
- dev AcrPush: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourcegroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u/providers/Microsoft.Authorization/roleAssignments/32749f64-68d1-5a44-9629-27583b35c669`
- prod Contributor: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourcegroups/rg-bdwus-prod/providers/Microsoft.Authorization/roleAssignments/767e378b-b53a-53ee-a702-7f932b57ee9c`
- prod AcrPush: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourcegroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u/providers/Microsoft.Authorization/roleAssignments/8fcda206-8850-557a-85cc-423903506ad6`

Do not run either provisioning template yet. Approval must identify the registry option, the new assignments, app/variable cutover, and the four old assignments above. No branch or Azure resource deletion is bundled with this proposal.

## Mandatory staged migration for an existing registry

Read the chosen registry's live mode first. While it still reports LegacyRegistryPermissions, apply the identity template with `verifiedRegistryRoleAssignmentMode=LegacyRegistryPermissions` to stage Repository Writer/Reader roles and registry-scoped ARM Reader for deploy identities (`az acr login` needs metadata resolution). Reader grants no registry credentials or repository content. This does not change the registry mode. Stage and verify replacement read roles for EVERY retained consumer too. Wait for assignments to propagate before switching; legacy AcrPull/AcrPush continue working during staging.

For approved bdwuscr reuse, deploy the retained legacy environment identity's `pricing-microservice` Reader using the cutover module in PR #29 before switching. No AXIOM registry mode change is authorized. Only after all replacement assignments are visible, switch bdwuscr to AbacRepositoryPermissions, read back the live mode, and use `verifiedRegistryRoleAssignmentMode=AbacRepositoryPermissions` for subsequent identity maintenance. Verify actual pushes/pulls and portal health before removing obsolete broad grants. Incremental Bicep cannot revoke them automatically.

The identity template is a maintenance proposal for the already-existing portal apps and environments; it is not an initial empty-resource-group bootstrap. Its live deployment compatibility remains unverified until approved.


## Ongoing foundation maintenance after cutover

The full foundation template also accepts `registryRoleAssignmentMode`, supplied by `REGISTRY_ROLE_ASSIGNMENT_MODE` in each azd environment. Set it to the observed mode, AbacRepositoryPermissions after this cutover, and point SHARED_REGISTRY_RESOURCE_ID at bdwuscr. Its runtime assignment then uses the same conditional Reader role and deterministic assignment ID as the targeted identity template, rather than reintroducing ineffective AcrPull. Existing legacy deployments require LegacyRegistryPermissions explicitly in their environment. Do not re-provision the full foundation as part of this targeted migration.
