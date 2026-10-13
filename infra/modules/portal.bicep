param environmentName string
param location string
param tags object
param environmentId string
param identityId string
param identityClientId string
param vaultUri string
param registryServer string
param sqlServer string
param sqlDatabase string
param tenantId string
param entraClientId string
param portalImage string
param insightsConnectionString string
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-bdwus-${environmentName}'
  location: location
  tags: union(tags, { 'azd-service-name': 'portal' })
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [{ server: registryServer, identity: identityId }]
      secrets: [{ name: 'entra-client-secret', keyVaultUrl: '${vaultUri}secrets/entra-client-secret', identity: identityId }]
      ingress: { external: true, targetPort: 8000, transport: 'auto', allowInsecure: false }
    }
    template: {
      scale: { minReplicas: 0, maxReplicas: 1, rules: [{ name: 'http', http: { metadata: { concurrentRequests: '10' } } }] }
      containers: [{
        name: 'portal'
        image: portalImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'SQL_SERVER', value: sqlServer }
          { name: 'SQL_DATABASE', value: sqlDatabase }
          { name: 'AZURE_CLIENT_ID', value: identityClientId }
          { name: 'AZURE_KEY_VAULT_URL', value: vaultUri }
          { name: 'AI_AUTH_MODE', value: 'managed_identity' }
          { name: 'ENTRA_TENANT_ID', value: tenantId }
          { name: 'PLATFORM_ENVIRONMENT', value: environmentName }
          { name: 'PLATFORM_AUTH_MODE', value: 'entra' }
          { name: 'PORTAL_STATIC_DIR', value: '/app/static' }
          { name: 'ENABLE_TEST_SUPPORT_API', value: 'false' }
          { name: 'AI_ASSISTANT_OFFLINE', value: 'true' }
          { name: 'ALLOWED_ORIGINS', value: '' }
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insightsConnectionString }
        ]
        probes: [{ type: 'Liveness', httpGet: { path: '/health', port: 8000 }, initialDelaySeconds: 30, periodSeconds: 30 }]
      }]
    }
  }
}
resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: app
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: ['/health']
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          openIdIssuer: 'https://login.microsoftonline.com/${tenantId}/v2.0'
          clientSecretSettingName: 'entra-client-secret'
        }
        validation: { allowedAudiences: [entraClientId, 'api://${entraClientId}'] }
      }
    }
    httpSettings: { requireHttps: true }
  }
}
output portalUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
