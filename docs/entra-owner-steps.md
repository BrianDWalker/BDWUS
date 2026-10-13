# Entra and GitHub owner configuration

Owner approved execution on 12 October 2026. Separate dev/prod sign-in apps, owner Admin assignments, Key Vault credentials, GitHub environments and OIDC identities are configured. The guidance below documents maintenance and recreation.

Create separate **single-tenant** BDWUS dev and prod application registrations in tenant `4e1db426-c797-4336-bd16-7e771a5de494`. Register the Web redirect URI `https://<portal-host>/.auth/login/aad/callback` for each environment. Set **Assignment required? Yes** on each Enterprise Application (service principal appRoleAssignmentRequired). Assign only intended users/groups. Define application roles with values Viewer, Executive, Sales, Care, Billing, Ops and Admin; assign the appropriate role, rather than relying on a browser role selector. An unrecognized/missing role defaults to Viewer. Initial Microsoft Graph configuration was executed under the owner approval.

Put the registration's secret into **that environment's** Key Vault as `entra-client-secret`. Do not reuse AXIOM's sign-in registration, secret or broker vaults. This secret is an unavoidable Easy Auth registration credential, referenced from Key Vault; SQL and registry access use managed identity. No secret value goes into Bicep, azd environment files, .env files, GitHub secrets or command-line arguments. Use the Azure portal secret editor or a protected temporary file and `az keyvault secret set --file <protected-file> --output none` after approval.

Container Apps Easy Auth owns sign-in redirects and injects identity headers. The API validates the tenant and derives authorization from the platform's role claims; it ignores browser-selected roles and demo bearer tokens in Entra mode. Never expose the container port through an ingress that bypasses Easy Auth. `/health` is the sole anonymous liveness endpoint. Local demo authentication requires explicit PLATFORM_AUTH_MODE=local and must never be configured on an Azure app.

Create GitHub environments **dev** and **prod**. Prod requires the owner as its sole reviewer, and only main may deploy. Main now has branch protection that prevents force pushes/deletion and uses pull requests. Dev deploys automatically on matching main pushes once the owner enables repository variable `BDWUS_DEPLOY_APPROVED=true`. Until that explicit approval the workflow is disabled. No workflow provisions resources or applies SQL.

Create a deployment identity per environment with federated credential issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:BrianDWalker/BDWUS:environment:dev` (or `:prod`). Grant only Contributor on the respective portal resource group and AcrPush on AXIOM's shared registry. These deployment identities are separate from runtime identities. Use environment variables AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, ACR_NAME, ACR_LOGIN_SERVER, PORTAL_RESOURCE_GROUP, PORTAL_APP_NAME. Client/tenant/subscription IDs are identifiers, not secrets. Configure production required review before enabling the workflow.

Sources: [Container Apps Entra authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra), [Identity claims](https://learn.microsoft.com/en-us/azure/container-apps/authentication), [Key Vault references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets).

After explicit approval and foundation provisioning, the separate GitHub identity template creates the per-environment identity, environment-bound OIDC credential, portal resource-group Contributor and shared-registry AcrPush. It cannot provision the portal or SQL. Review and repeat for prod:

```sh
az bicep build --file infra/github-deploy/main.bicep --outfile /tmp/bdwus-github.json
# MUTATION — owner approval required:
az deployment sub create --location eastus --template-file infra/github-deploy/main.bicep --parameters environmentName=dev sharedRegistryResourceId=/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/rg-financial-advisor-8a42/providers/Microsoft.ContainerRegistry/registries/crfinancialadvisor8a42vuti2u --query properties.outputs.clientId.value -o tsv
```

Use the returned nonsecret client ID as that GitHub environment's AZURE_CLIENT_ID. Runtime and deployment identities are separate.

Initial app creation uses PORTAL_PUBLIC_INGRESS=false so public requests cannot reach the container before Easy Auth is installed. Verify the enabled auth configuration, tenant and audience, then enable PORTAL_PUBLIC_INGRESS and provision again. Maintain true for subsequent approved releases. No temporary firewall or authentication bypass is used.

## Initial configuration completed — 13 October 2026

Dev client ID `4aaa3bab-43a3-4f4c-9f6c-ebfcfb88de97`, vault `kv-bdwus-dev-n7g4bi`; production client ID `02880795-d949-4cc1-beac-47ec2e1b880c`, vault `kv-bdwus-prod-vwimhm`. Both sign-in credentials are already stored as `entra-client-secret`, expire 13 October 2027, and are referenced by the app. Owner Admin assignments and callback URIs are configured. No secret entry or registration setup remains for the owner. The optional `github-token` is not configured; AI/repository operations remain disabled. GitHub deployment identities, environment variables, main-only restrictions and owner-only production review are configured; `BDWUS_DEPLOY_APPROVED=true` is enabled. Future production runs still require the GitHub environment review.
