# Entra and GitHub owner configuration

These are review instructions; no registrations, assignments, federated credentials or GitHub settings have been changed.

Create separate **single-tenant** BDWUS dev and prod application registrations in tenant `4e1db426-c797-4336-bd16-7e771a5de494`. Register the Web redirect URI `https://<portal-host>/.auth/login/aad/callback` for each environment. Set **Assignment required? Yes** on each Enterprise Application (service principal appRoleAssignmentRequired). Assign only intended users/groups. Define application roles with values Viewer, Executive, Sales, Care, Billing, Ops and Admin; assign the appropriate role, rather than relying on a browser role selector. An unrecognized/missing role defaults to Viewer. Microsoft Graph changes are intentionally left for owner approval.

Put the registration's secret into **that environment's** Key Vault as `entra-client-secret`. Do not reuse AXIOM's sign-in registration, secret or broker vaults. This secret is an unavoidable Easy Auth registration credential, referenced from Key Vault; SQL and registry access use managed identity. No secret value goes into Bicep, azd environment files, .env files, GitHub secrets or command-line arguments. Use the Azure portal secret editor or a protected temporary file and `az keyvault secret set --file <protected-file> --output none` after approval.

Container Apps Easy Auth owns sign-in redirects and injects identity headers. The API validates the tenant and derives authorization from the platform's role claims; it ignores browser-selected roles and demo bearer tokens in Entra mode. Never expose the container port through an ingress that bypasses Easy Auth. `/health` is the sole anonymous liveness endpoint. Local demo authentication requires explicit PLATFORM_AUTH_MODE=local and must never be configured on an Azure app.

Create GitHub environments **dev** and **prod**. Prod requires the owner as its sole reviewer, and only the protected main branch may deploy. Dev deploys automatically on matching main pushes once the owner enables repository variable `BDWUS_DEPLOY_APPROVED=true`. Until that explicit approval the workflow is disabled. No workflow provisions resources or applies SQL.

Create a deployment identity per environment with federated credential issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:BrianDWalker/BDWUS:environment:dev` (or `:prod`). Grant only Contributor on the respective portal resource group and AcrPush on AXIOM's shared registry. These deployment identities are separate from runtime identities. Use environment variables AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, ACR_NAME, ACR_LOGIN_SERVER, PORTAL_RESOURCE_GROUP, PORTAL_APP_NAME. Client/tenant/subscription IDs are identifiers, not secrets. Configure production required review before enabling the workflow.

Sources: [Container Apps Entra authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra), [Identity claims](https://learn.microsoft.com/en-us/azure/container-apps/authentication), [Key Vault references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets).

After explicit approval and foundation provisioning, the separate GitHub identity template creates the per-environment identity, environment-bound OIDC credential, portal resource-group Contributor and shared-registry AcrPush. It cannot provision the portal or SQL. Review and repeat for prod:

```sh
az bicep build --file infra/github-deploy/main.bicep --outfile /tmp/bdwus-github.json
# MUTATION — owner approval required:
az deployment sub create --location eastus --template-file infra/github-deploy/main.bicep --parameters environmentName=dev sharedRegistryResourceId=/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u --query properties.outputs.clientId.value -o tsv
```

Use the returned nonsecret client ID as that GitHub environment's AZURE_CLIENT_ID. Runtime and deployment identities are separate.
