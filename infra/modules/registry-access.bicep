param registryName string
param principalId string
param useAbac bool = false
var roleDefinitionId = useAbac ? 'b93aa761-3e63-49ed-ac28-beffa264f7ac' : '7f951dda-4ed3-4680-a7ca-43fe172d538d'
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: useAbac ? guid(registry.id, principalId, roleDefinitionId, 'bdwus-portal-only') : guid(registry.id, principalId, roleDefinitionId)
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    conditionVersion: useAbac ? '2.0' : null
    condition: useAbac ? '''
      (
        (!(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})
          AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'}))
        OR (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'bdwus-portal')
      )
      ''' : null
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
  }
}
output registryServer string = registry.properties.loginServer
