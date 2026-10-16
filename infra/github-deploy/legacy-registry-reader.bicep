// Preserve the retained legacy BDWUS app's existing pull access during ABAC migration.
param registryName string = 'bdwuscr'
param principalId string = 'c9788f97-93ee-4cf0-95d6-d8fcc4ca874f'
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
var roleId = 'b93aa761-3e63-49ed-ac28-beffa264f7ac'
resource access 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, principalId, roleId, 'legacy-pricing-microservice')
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    conditionVersion: '2.0'
    condition: '''
      (
        (!(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})
          AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'}))
        OR (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'pricing-microservice')
      )
      '''
  }
}
