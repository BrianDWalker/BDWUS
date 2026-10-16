param environmentName string
param location string
param repository string
param deploymentRoleId string
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-bdwus-github-${environmentName}'
  location: location
}
resource credential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: identity
  name: 'github-${environmentName}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    audiences: ['api://AzureADTokenExchange']
    subject: 'repo:${repository}:environment:${environmentName}'
  }
}
resource portal 'Microsoft.App/containerApps@2024-03-01' existing = { name: 'ca-bdwus-${environmentName}' }
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = { name: 'cae-bdwus-${environmentName}' }
resource runtime 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: 'id-bdwus-${environmentName}' }
resource appDeployment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(portal.id, identity.id, deploymentRoleId)
  scope: portal
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: deploymentRoleId }
}
resource environmentRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(environment.id, identity.id, deploymentRoleId)
  scope: environment
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: deploymentRoleId }
}
resource runtimeAssign 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(runtime.id, identity.id, deploymentRoleId)
  scope: runtime
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: deploymentRoleId }
}
output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
output runtimePrincipalId string = runtime.properties.principalId
