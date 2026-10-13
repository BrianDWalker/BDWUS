param serverName string
@allowed(['dev', 'prod'])
param environmentName string
param location string
resource server 'Microsoft.Sql/servers@2023-08-01' existing = { name: serverName }
// Production is referenced only. No writable declaration of AZBDWUSP exists.
resource prod 'Microsoft.Sql/servers/databases@2023-08-01' existing = {
  parent: server
  name: 'AZBDWUSP'
}
resource dev 'Microsoft.Sql/servers/databases@2023-08-01' = if (environmentName == 'dev') {
  parent: server
  name: 'AZBDWUSDEV'
  location: location
  sku: { name: 'GP_S_Gen5', tier: 'GeneralPurpose', family: 'Gen5', capacity: 1 }
  properties: {
    maxSizeBytes: 34359738368
    minCapacity: json('0.5')
    autoPauseDelay: 60
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
    requestedBackupStorageRedundancy: 'Local'
  }
}
output databaseName string = environmentName == 'dev' ? dev!.name : prod.name

output serverFqdn string = server.properties.fullyQualifiedDomainName
