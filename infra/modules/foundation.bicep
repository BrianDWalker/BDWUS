param environmentName string
param location string
param tags object
param sharedWorkspaceResourceId string
param budgetAmount int
param budgetEmails array
param budgetStartDate string
param budgetEndDate string
var suffix = take(uniqueString(subscription().id, resourceGroup().name), 6)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-bdwus-${environmentName}'
  location: location
  tags: tags
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-bdwus-${environmentName}-${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
  }
}
resource vaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, 'secrets-user')
  scope: vault
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-bdwus-${environmentName}'
  location: location
  tags: tags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: sharedWorkspaceResourceId }
}
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-bdwus-${environmentName}'
  location: location
  tags: tags
  properties: {
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
    appLogsConfiguration: { destination: 'azure-monitor' }
  }
}
resource logs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'bdwus-logs'
  scope: environment
  properties: {
    workspaceId: sharedWorkspaceResourceId
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
  }
}
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'bdwus-${environmentName}'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate, endDate: budgetEndDate }
    notifications: {
      actual80: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 80, thresholdType: 'Actual', contactEmails: budgetEmails }
      actual100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Actual', contactEmails: budgetEmails }
      forecast100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Forecasted', contactEmails: budgetEmails }
    }
  }
}
output identityId string = identity.id
output principalId string = identity.properties.principalId
output identityClientId string = identity.properties.clientId
output identityName string = identity.name
output vaultName string = vault.name
output vaultUri string = vault.properties.vaultUri
output environmentId string = environment.id
output insightsConnectionString string = insights.properties.ConnectionString
