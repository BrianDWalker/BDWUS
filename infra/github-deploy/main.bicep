targetScope = 'subscription'
@allowed(['dev', 'prod'])
param environmentName string
param location string = 'eastus'
param repository string = 'BrianDWalker/BDWUS'
param sharedRegistryResourceId string
var registryParts = split(sharedRegistryResourceId, '/')
module identity './identity.bicep' = {
  name: 'bdwus-github-${environmentName}'
  scope: resourceGroup('rg-bdwus-${environmentName}')
  params: { environmentName: environmentName, location: location, repository: repository }
}
module registryPush '../modules/registry-access.bicep' = {
  name: 'bdwus-github-registry-${environmentName}'
  scope: resourceGroup(registryParts[2], registryParts[4])
  params: {
    registryName: last(registryParts)
    principalId: identity.outputs.principalId
    roleDefinitionId: '8311e382-0749-4cb8-b61a-304f252e45ec'
  }
}
output clientId string = identity.outputs.clientId
