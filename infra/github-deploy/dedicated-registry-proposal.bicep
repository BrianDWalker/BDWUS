// OPTIONAL PROPOSAL: deploy only if owner chooses a new BDWUS-only registry.
// An alternative is to retain/reuse the existing bdwuscr after dependency review.
param location string = 'eastus'
@minLength(5)
@maxLength(50)
param registryName string
resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false, roleAssignmentMode: 'AbacRepositoryPermissions' }
}
output registryResourceId string = registry.id
