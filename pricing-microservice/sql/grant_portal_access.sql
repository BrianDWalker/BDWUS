-- Owner approval required. Run as the existing SQL Entra administrator.
-- Replace PORTAL_IDENTITY_NAME with the per-environment managed identity name.
-- Execute separately in AZBDWUSDEV and AZBDWUSP, after reviewing the schema.
-- This grants SQL data-plane permissions, not ARM management permissions.
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'PORTAL_IDENTITY_NAME')
  CREATE USER [PORTAL_IDENTITY_NAME] FROM EXTERNAL PROVIDER;
GO
IF DATABASE_PRINCIPAL_ID(N'bdwus_portal') IS NULL
  CREATE ROLE [bdwus_portal];
GO
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::billing TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::ms TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::ops TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::admin TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::billingops TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::care TO [bdwus_portal];
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::ai TO [bdwus_portal];
GRANT SELECT ON SCHEMA::report TO [bdwus_portal];
GRANT SELECT ON SCHEMA::knowledge TO [bdwus_portal];
ALTER ROLE [bdwus_portal] ADD MEMBER [PORTAL_IDENTITY_NAME];
GO
-- No db_owner or db_ddladmin. Server identity may need Directory Readers to
-- resolve EXTERNAL PROVIDER identities; review before granting directory access.
