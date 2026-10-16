targetScope = 'subscription'

@allowed(['dev', 'prod'])
param environmentName string
param location string = 'eastus'
param sharedRegistryResourceId string
@allowed(['LegacyRegistryPermissions', 'AbacRepositoryPermissions'])
param registryRoleAssignmentMode string = 'LegacyRegistryPermissions' 
param sharedWorkspaceResourceId string
param sqlServerResourceId string
param sqlLocation string = 'eastus'
param tenantId string
param entraClientId string
param portalImage string
param budgetEmails array
param budgetStartDate string
param budgetEndDate string
param devBudgetAmount int = 10
param prodBudgetAmount int = 25
@description('Leave false for foundation provisioning. Enable only after vault secrets and SQL grants are approved and ready.')
@allowed(['false', 'true'])
param deployPortal string = 'false'
@description('Keep first app creation private until Easy Auth has been verified. Set true only for the final ingress stage.')
@allowed(['false', 'true'])
param publicIngress string = 'false'
var portalEnabled = deployPortal == 'true'

var registryParts = split(sharedRegistryResourceId, '/')
var sqlParts = split(sqlServerResourceId, '/')
var tags = { workload: 'bdwus', 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-bdwus-${environmentName}'
  location: location
  tags: tags
}

module foundation './modules/foundation.bicep' = {
  name: 'bdwus-foundation-${environmentName}'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sharedWorkspaceResourceId: sharedWorkspaceResourceId
    budgetAmount: environmentName == 'dev' ? devBudgetAmount : prodBudgetAmount
    budgetEmails: budgetEmails
    budgetStartDate: budgetStartDate
    budgetEndDate: budgetEndDate
  }
}

module registryAccess './modules/registry-access.bicep' = {
  name: 'bdwus-registry-${environmentName}'
  scope: resourceGroup(registryParts[2], registryParts[4])
  params: { registryName: last(registryParts), principalId: foundation.outputs.principalId, useAbac: registryRoleAssignmentMode == 'AbacRepositoryPermissions' }
}

module database './modules/database.bicep' = {
  name: 'bdwus-database-${environmentName}'
  scope: resourceGroup(sqlParts[2], sqlParts[4])
  params: {
    serverName: last(sqlParts)
    environmentName: environmentName
    location: sqlLocation
  }
}

module portal './modules/portal.bicep' = if (portalEnabled) {
  name: 'bdwus-portal-${environmentName}'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    environmentId: foundation.outputs.environmentId
    identityId: foundation.outputs.identityId
    identityClientId: foundation.outputs.identityClientId
    vaultUri: foundation.outputs.vaultUri
    registryServer: registryAccess.outputs.registryServer
    sqlServer: database.outputs.serverFqdn
    sqlDatabase: database.outputs.databaseName
    tenantId: tenantId
    entraClientId: entraClientId
    portalImage: portalImage
    publicIngressEnabled: publicIngress == 'true'
    insightsConnectionString: foundation.outputs.insightsConnectionString
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registryAccess.outputs.registryServer
output AZURE_CONTAINER_REGISTRY_NAME string = last(registryParts)
output AZURE_KEY_VAULT_NAME string = foundation.outputs.vaultName
output AZURE_KEY_VAULT_URL string = foundation.outputs.vaultUri
output AZURE_MANAGED_IDENTITY_PRINCIPAL_ID string = foundation.outputs.principalId
output AZURE_MANAGED_IDENTITY_NAME string = foundation.outputs.identityName
output SERVICE_PORTAL_NAME string = 'ca-bdwus-${environmentName}'
output SQL_SERVER string = database.outputs.serverFqdn
output SQL_DATABASE string = database.outputs.databaseName
output PORTAL_URL string = portalEnabled ? portal!.outputs.portalUrl : ''
