param registryName string
param principalId string
param writeAccess bool
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
var roleId = writeAccess ? '2a1e307c-b015-4ebd-883e-5b7698a07328' : 'b93aa761-3e63-49ed-ac28-beffa264f7ac'
resource repositoryAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, principalId, roleId, 'bdwus-portal-only')
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    conditionVersion: '2.0'
    condition: '''
      (
        (
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})
          AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'})
          AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/write'})
          AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/write'})
        )
        OR (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'bdwus-portal')
      )
      '''
  }
}

// az acr login resolves the registry through ARM before using repository data access.
resource registryMetadataRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (writeAccess) {
  name: guid(registry.id, principalId, 'registry-metadata-reader')
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
  }
}
