targetScope = 'subscription'
@allowed(['dev', 'prod'])
param environmentName string
param location string = 'eastus'
param repository string = 'BrianDWalker/BDWUS'
param sharedRegistryResourceId string
// Required acknowledgement only after the read-only live mode check in the runbook.
@allowed(['AbacRepositoryPermissions'])
param verifiedRegistryRoleAssignmentMode string
// Existing shared registry MUST first undergo an owner-approved ABAC migration.
// This template deliberately does not change shared registry configuration.
var registryParts = split(sharedRegistryResourceId, '/')
resource deploymentRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(subscription().id, 'bdwus-portal-deployer-v1')
  properties: {
    roleName: 'BDWUS Portal Deployer'
    description: 'Update an existing portal; CLI compatibility requires listSecrets. No resource-group Contributor.'
    type: 'CustomRole'
    assignableScopes: [
      subscriptionResourceId('Microsoft.Resources/resourceGroups', 'rg-bdwus-dev')
      subscriptionResourceId('Microsoft.Resources/resourceGroups', 'rg-bdwus-prod')
    ]
    permissions: [{
      actions: [
        'Microsoft.App/containerApps/read'
        'Microsoft.App/containerApps/write'
        'Microsoft.App/containerApps/revisions/read'
        'Microsoft.App/containerApps/listSecrets/action'
        'Microsoft.App/managedEnvironments/read'
        'Microsoft.ManagedIdentity/userAssignedIdentities/read'
        'Microsoft.ManagedIdentity/userAssignedIdentities/assign/action'
      ]
      notActions: []
      dataActions: []
      notDataActions: []
    }]
  }
}
module identity './identity.bicep' = {
  name: 'bdwus-github-${environmentName}'
  scope: resourceGroup('rg-bdwus-${environmentName}')
  params: { environmentName: environmentName, location: location, repository: repository, deploymentRoleId: deploymentRole.id }
}
module registryPush './repository-access.bicep' = {
  name: 'bdwus-github-repository-${environmentName}'
  scope: resourceGroup(registryParts[2], registryParts[4])
  params: { registryName: last(registryParts), principalId: identity.outputs.principalId, writeAccess: true }
}
module registryPull './repository-access.bicep' = {
  name: 'bdwus-runtime-repository-${environmentName}'
  scope: resourceGroup(registryParts[2], registryParts[4])
  params: { registryName: last(registryParts), principalId: identity.outputs.runtimePrincipalId, writeAccess: false }
}
output clientId string = identity.outputs.clientId

output requiredRegistryMode string = verifiedRegistryRoleAssignmentMode
