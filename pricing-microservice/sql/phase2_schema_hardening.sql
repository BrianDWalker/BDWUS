/*
  fc-gpt Phase 2 schema hardening.

  Purpose:
  - Move runtime-created operational schemas into source-controlled SQL.
  - Add durable SQL sources for report definitions and Knowledge content.
  - Seed missing billing elements so Product & Pricing is not backed by an empty table.
  - Add basic indexes for the API read paths.

  This script is idempotent and safe to rerun.
*/

IF SCHEMA_ID('ops') IS NULL EXEC('CREATE SCHEMA ops');
IF SCHEMA_ID('admin') IS NULL EXEC('CREATE SCHEMA admin');
IF SCHEMA_ID('billingops') IS NULL EXEC('CREATE SCHEMA billingops');
IF SCHEMA_ID('care') IS NULL EXEC('CREATE SCHEMA care');
IF SCHEMA_ID('report') IS NULL EXEC('CREATE SCHEMA report');
IF SCHEMA_ID('knowledge') IS NULL EXEC('CREATE SCHEMA knowledge');
GO

IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaMigrations (
    MigrationId NVARCHAR(120) NOT NULL PRIMARY KEY,
    Description NVARCHAR(400) NOT NULL,
    AppliedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('ops.Orders', 'U') IS NULL
BEGIN
  CREATE TABLE ops.Orders (
    OrderId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OrderNumber NVARCHAR(32) NOT NULL,
    CustomerNumber NVARCHAR(32) NULL,
    AccountName NVARCHAR(200) NOT NULL,
    ServiceName NVARCHAR(200) NOT NULL,
    LifecycleStage NVARCHAR(100) NOT NULL,
    OverallStatus NVARCHAR(100) NOT NULL,
    SlaStatus NVARCHAR(100) NOT NULL,
    DueDate DATE NULL,
    AssignedTeam NVARCHAR(200) NULL,
    CircuitId NVARCHAR(64) NULL,
    Location NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('ops.Orders', 'UpdatedAtUtc') IS NULL ALTER TABLE ops.Orders ADD UpdatedAtUtc DATETIME2 NULL;
GO

IF OBJECT_ID('ops.NetworkEvents', 'U') IS NULL
BEGIN
  CREATE TABLE ops.NetworkEvents (
    EventId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    EventNumber NVARCHAR(32) NOT NULL,
    Market NVARCHAR(100) NOT NULL,
    Type NVARCHAR(100) NOT NULL,
    Impacted NVARCHAR(200) NOT NULL,
    Severity NVARCHAR(50) NOT NULL,
    SlaExposure DECIMAL(18,2) NOT NULL DEFAULT 0,
    Status NVARCHAR(50) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('ops.NetworkEvents', 'UpdatedAtUtc') IS NULL ALTER TABLE ops.NetworkEvents ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('ops.NetworkEvents', 'IsDeleted') IS NULL ALTER TABLE ops.NetworkEvents ADD IsDeleted BIT NOT NULL CONSTRAINT DF_ops_NetworkEvents_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('ops.ProvisioningJobs', 'U') IS NULL
BEGIN
  CREATE TABLE ops.ProvisioningJobs (
    ProvisioningJobId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OrderId UNIQUEIDENTIFIER NULL,
    JobNumber NVARCHAR(32) NOT NULL,
    JobType NVARCHAR(100) NOT NULL,
    OwnerName NVARCHAR(200) NULL,
    Status NVARCHAR(50) NOT NULL,
    DueDate DATE NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('ops.ProvisioningJobs', 'UpdatedAtUtc') IS NULL ALTER TABLE ops.ProvisioningJobs ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('ops.ProvisioningJobs', 'IsDeleted') IS NULL ALTER TABLE ops.ProvisioningJobs ADD IsDeleted BIT NOT NULL CONSTRAINT DF_ops_ProvisioningJobs_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('ops.Settlements', 'U') IS NULL
BEGIN
  CREATE TABLE ops.Settlements (
    SettlementId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SettlementNumber NVARCHAR(32) NOT NULL,
    PartnerName NVARCHAR(200) NOT NULL,
    BillingPeriod NVARCHAR(32) NOT NULL,
    ExposureAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    Status NVARCHAR(50) NOT NULL,
    ClaimType NVARCHAR(100) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('ops.Settlements', 'UpdatedAtUtc') IS NULL ALTER TABLE ops.Settlements ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('ops.Settlements', 'IsDeleted') IS NULL ALTER TABLE ops.Settlements ADD IsDeleted BIT NOT NULL CONSTRAINT DF_ops_Settlements_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('admin.Users', 'U') IS NULL
BEGIN
  CREATE TABLE admin.Users (
    UserId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserNumber NVARCHAR(32) NOT NULL,
    UserName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(200) NULL,
    RoleName NVARCHAR(200) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    LastLoginAtUtc DATETIME2 NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('admin.Users', 'UpdatedAtUtc') IS NULL ALTER TABLE admin.Users ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('admin.Users', 'IsDeleted') IS NULL ALTER TABLE admin.Users ADD IsDeleted BIT NOT NULL CONSTRAINT DF_admin_Users_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('admin.Roles', 'U') IS NULL
BEGIN
  CREATE TABLE admin.Roles (
    RoleId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    RoleNumber NVARCHAR(32) NOT NULL,
    RoleName NVARCHAR(200) NOT NULL,
    PermissionsJson NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('admin.Roles', 'UpdatedAtUtc') IS NULL ALTER TABLE admin.Roles ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('admin.Roles', 'IsDeleted') IS NULL ALTER TABLE admin.Roles ADD IsDeleted BIT NOT NULL CONSTRAINT DF_admin_Roles_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('admin.Integrations', 'U') IS NULL
BEGIN
  CREATE TABLE admin.Integrations (
    IntegrationId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    IntegrationNumber NVARCHAR(32) NOT NULL,
    IntegrationName NVARCHAR(200) NOT NULL,
    OwnerName NVARCHAR(200) NULL,
    Status NVARCHAR(50) NOT NULL,
    Detail NVARCHAR(400) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('admin.Integrations', 'UpdatedAtUtc') IS NULL ALTER TABLE admin.Integrations ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('admin.Integrations', 'IsDeleted') IS NULL ALTER TABLE admin.Integrations ADD IsDeleted BIT NOT NULL CONSTRAINT DF_admin_Integrations_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('billingops.Invoices', 'U') IS NULL
BEGIN
  CREATE TABLE billingops.Invoices (
    InvoiceId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceNumber NVARCHAR(32) NOT NULL,
    CustomerNumber NVARCHAR(32) NULL,
    AccountName NVARCHAR(200) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Balance DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    InvoiceDate DATE NULL,
    DueDate DATE NULL,
    BillingProfile NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('billingops.Invoices', 'UpdatedAtUtc') IS NULL ALTER TABLE billingops.Invoices ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('billingops.Invoices', 'IsDeleted') IS NULL ALTER TABLE billingops.Invoices ADD IsDeleted BIT NOT NULL CONSTRAINT DF_billingops_Invoices_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('billingops.InvoiceActions', 'U') IS NULL
BEGIN
  CREATE TABLE billingops.InvoiceActions (
    InvoiceActionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    ActionType NVARCHAR(100) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    RequestedBy NVARCHAR(200) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('billingops.InvoiceActions', 'UpdatedAtUtc') IS NULL ALTER TABLE billingops.InvoiceActions ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('billingops.InvoiceActions', 'IsDeleted') IS NULL ALTER TABLE billingops.InvoiceActions ADD IsDeleted BIT NOT NULL CONSTRAINT DF_billingops_InvoiceActions_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('billingops.Adjustments', 'U') IS NULL
BEGIN
  CREATE TABLE billingops.Adjustments (
    AdjustmentId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NULL,
    AdjustmentNumber NVARCHAR(32) NOT NULL,
    AdjustmentType NVARCHAR(100) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    Reason NVARCHAR(MAX) NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('billingops.Adjustments', 'UpdatedAtUtc') IS NULL ALTER TABLE billingops.Adjustments ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('billingops.Adjustments', 'IsDeleted') IS NULL ALTER TABLE billingops.Adjustments ADD IsDeleted BIT NOT NULL CONSTRAINT DF_billingops_Adjustments_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('care.Tickets', 'U') IS NULL
BEGIN
  CREATE TABLE care.Tickets (
    TicketId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TicketNumber NVARCHAR(32) NOT NULL,
    CustomerNumber NVARCHAR(32) NULL,
    AccountName NVARCHAR(200) NOT NULL,
    IssueType NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100) NOT NULL,
    Priority NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    OwnerName NVARCHAR(200) NULL,
    Summary NVARCHAR(MAX) NULL,
    EscalationLevel NVARCHAR(50) NULL,
    SlaTargetHours INT NULL,
    ClosureReason NVARCHAR(400) NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL,
    ClosedAtUtc DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF COL_LENGTH('care.Tickets', 'EscalationLevel') IS NULL ALTER TABLE care.Tickets ADD EscalationLevel NVARCHAR(50) NULL;
IF COL_LENGTH('care.Tickets', 'SlaTargetHours') IS NULL ALTER TABLE care.Tickets ADD SlaTargetHours INT NULL;
IF COL_LENGTH('care.Tickets', 'ClosureReason') IS NULL ALTER TABLE care.Tickets ADD ClosureReason NVARCHAR(400) NULL;
IF COL_LENGTH('care.Tickets', 'ClosedAtUtc') IS NULL ALTER TABLE care.Tickets ADD ClosedAtUtc DATETIME2 NULL;
IF COL_LENGTH('care.Tickets', 'UpdatedAtUtc') IS NULL ALTER TABLE care.Tickets ADD UpdatedAtUtc DATETIME2 NULL;
IF COL_LENGTH('care.Tickets', 'IsDeleted') IS NULL ALTER TABLE care.Tickets ADD IsDeleted BIT NOT NULL CONSTRAINT DF_care_Tickets_IsDeleted DEFAULT 0;
GO

IF OBJECT_ID('care.TicketNotes', 'U') IS NULL
BEGIN
  CREATE TABLE care.TicketNotes (
    TicketNoteId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TicketId UNIQUEIDENTIFIER NOT NULL,
    NoteType NVARCHAR(100) NOT NULL,
    Note NVARCHAR(MAX) NOT NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('report.ReportDefinitions', 'U') IS NULL
BEGIN
  CREATE TABLE report.ReportDefinitions (
    ReportId NVARCHAR(80) NOT NULL PRIMARY KEY,
    ReportName NVARCHAR(200) NOT NULL,
    Area NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    SortOrder INT NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

MERGE report.ReportDefinitions AS target
USING (VALUES
  ('executive-scorecard', 'Executive scorecard', 'Executive', 'Pipeline, quoted value, approvals, and contract coverage.', 10),
  ('pricing-approval-queue', 'Pricing approval queue', 'Pricing', 'Quotes and custom pricing requests waiting on review.', 20),
  ('customer-revenue', 'Customer revenue watchlist', 'Billing', 'Customer MRR and account exposure across active accounts.', 30)
) AS source (ReportId, ReportName, Area, Description, SortOrder)
ON target.ReportId = source.ReportId
WHEN MATCHED THEN
  UPDATE SET
    ReportName = source.ReportName,
    Area = source.Area,
    Description = source.Description,
    SortOrder = source.SortOrder,
    Status = 'Active',
    UpdatedAtUtc = SYSUTCDATETIME(),
    IsDeleted = 0
WHEN NOT MATCHED THEN
  INSERT (ReportId, ReportName, Area, Description, SortOrder)
  VALUES (source.ReportId, source.ReportName, source.Area, source.Description, source.SortOrder);
GO

CREATE OR ALTER VIEW report.vReportDefinitions AS
SELECT
  ReportId AS id,
  ReportName AS name,
  Area AS area,
  Description AS description,
  SortOrder,
  Status
FROM report.ReportDefinitions
WHERE IsDeleted = 0;
GO

IF OBJECT_ID('knowledge.Topics', 'U') IS NULL
BEGIN
  CREATE TABLE knowledge.Topics (
    TopicId NVARCHAR(40) NOT NULL PRIMARY KEY,
    TopicName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    SortOrder INT NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('knowledge.Documents', 'U') IS NULL
BEGIN
  CREATE TABLE knowledge.Documents (
    DocumentId NVARCHAR(40) NOT NULL PRIMARY KEY,
    Title NVARCHAR(250) NOT NULL,
    Category NVARCHAR(100) NOT NULL,
    Audience NVARCHAR(250) NULL,
    UpdatedDate DATE NULL,
    OwnerName NVARCHAR(200) NULL,
    Summary NVARCHAR(MAX) NOT NULL,
    SourceUrl NVARCHAR(500) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('knowledge.DocumentTopics', 'U') IS NULL
BEGIN
  CREATE TABLE knowledge.DocumentTopics (
    DocumentId NVARCHAR(40) NOT NULL,
    TopicId NVARCHAR(40) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_knowledge_DocumentTopics PRIMARY KEY (DocumentId, TopicId)
  );
END;
GO

MERGE knowledge.Topics AS target
USING (VALUES
  ('TOPIC-1', 'Provisioning', 'Steps, dependencies, and approval gates for service turn-up.', 10),
  ('TOPIC-2', 'Pricing', 'Current pricing guidance, exceptions, and margin guardrails.', 20),
  ('TOPIC-3', 'Support', 'Troubleshooting, escalation paths, and customer communications.', 30),
  ('TOPIC-4', 'Training', 'Playbooks, onboarding, and role-based enablement materials.', 40)
) AS source (TopicId, TopicName, Description, SortOrder)
ON target.TopicId = source.TopicId
WHEN MATCHED THEN
  UPDATE SET TopicName = source.TopicName, Description = source.Description, SortOrder = source.SortOrder, UpdatedAtUtc = SYSUTCDATETIME(), IsDeleted = 0
WHEN NOT MATCHED THEN
  INSERT (TopicId, TopicName, Description, SortOrder)
  VALUES (source.TopicId, source.TopicName, source.Description, source.SortOrder);
GO

MERGE knowledge.Documents AS target
USING (VALUES
  ('KNOW-1', 'Fiber provisioning playbook', 'Process', 'Sales, Operations, Support', CONVERT(date, '2026-05-13'), 'Operations', 'End-to-end provisioning steps for fiber installs, handoffs, and escalation checkpoints.'),
  ('KNOW-2', 'Wireless package pricing guide', 'Pricing', 'Sales, Product', CONVERT(date, '2026-05-12'), 'Product', 'Current rate cards, approval thresholds, and discount guardrails for wireless bundles.'),
  ('KNOW-3', 'Customer onboarding checklist', 'Customer-facing', 'Sales, Customer Service', CONVERT(date, '2026-05-09'), 'Customer Success', 'What teams need before kickoff, including contacts, services, and delivery dependencies.'),
  ('KNOW-4', 'Troubleshooting guide - DIA', 'Support', 'Support, Network', CONVERT(date, '2026-05-11'), 'Network', 'Common symptoms, diagnostics, and service-impact questions for DIA incidents.'),
  ('KNOW-5', 'Sales qualification framework', 'Playbook', 'Sales', CONVERT(date, '2026-05-08'), 'Sales Operations', 'How to qualify a lead, capture needs, and hand off to the opportunity stage.')
) AS source (DocumentId, Title, Category, Audience, UpdatedDate, OwnerName, Summary)
ON target.DocumentId = source.DocumentId
WHEN MATCHED THEN
  UPDATE SET
    Title = source.Title,
    Category = source.Category,
    Audience = source.Audience,
    UpdatedDate = source.UpdatedDate,
    OwnerName = source.OwnerName,
    Summary = source.Summary,
    UpdatedAtUtc = SYSUTCDATETIME(),
    IsDeleted = 0
WHEN NOT MATCHED THEN
  INSERT (DocumentId, Title, Category, Audience, UpdatedDate, OwnerName, Summary)
  VALUES (source.DocumentId, source.Title, source.Category, source.Audience, source.UpdatedDate, source.OwnerName, source.Summary);
GO

MERGE knowledge.DocumentTopics AS target
USING (VALUES
  ('KNOW-1', 'TOPIC-1'),
  ('KNOW-2', 'TOPIC-2'),
  ('KNOW-3', 'TOPIC-1'),
  ('KNOW-3', 'TOPIC-4'),
  ('KNOW-4', 'TOPIC-3'),
  ('KNOW-5', 'TOPIC-4')
) AS source (DocumentId, TopicId)
ON target.DocumentId = source.DocumentId AND target.TopicId = source.TopicId
WHEN NOT MATCHED THEN
  INSERT (DocumentId, TopicId)
  VALUES (source.DocumentId, source.TopicId);
GO

CREATE OR ALTER VIEW knowledge.vDocuments AS
SELECT
  d.DocumentId AS id,
  d.Title AS title,
  d.Category AS category,
  d.Audience AS audience,
  d.UpdatedDate AS updated,
  d.OwnerName AS owner,
  d.Summary AS summary,
  STRING_AGG(t.TopicName, ', ') AS topics
FROM knowledge.Documents d
LEFT JOIN knowledge.DocumentTopics dt ON dt.DocumentId = d.DocumentId
LEFT JOIN knowledge.Topics t ON t.TopicId = dt.TopicId AND t.IsDeleted = 0
WHERE d.IsDeleted = 0
GROUP BY d.DocumentId, d.Title, d.Category, d.Audience, d.UpdatedDate, d.OwnerName, d.Summary;
GO

MERGE billing.BillingElements AS target
USING (
  SELECT
    CONVERT(uniqueidentifier, '11111111-1111-4111-8111-111111111111') AS BillingElementId,
    bc.BillingCodeId,
    'DIA recurring access charge' AS ElementName,
    'Recurring' AS ElementType,
    CONVERT(decimal(18,2), 5200.00) AS Amount
  FROM billing.BillingCodes bc WHERE bc.Code = 'DIA-MRC'
  UNION ALL SELECT CONVERT(uniqueidentifier, '22222222-2222-4222-8222-222222222222'), bc.BillingCodeId, 'DIA installation charge', 'One-time', CONVERT(decimal(18,2), 2200.00) FROM billing.BillingCodes bc WHERE bc.Code = 'DIA-NRC'
  UNION ALL SELECT CONVERT(uniqueidentifier, '33333333-3333-4333-8333-333333333333'), bc.BillingCodeId, 'Cloud Voice seat charge', 'Recurring', CONVERT(decimal(18,2), 120.00) FROM billing.BillingCodes bc WHERE bc.Code = 'CVO-MRC'
  UNION ALL SELECT CONVERT(uniqueidentifier, '44444444-4444-4444-8444-444444444444'), bc.BillingCodeId, 'SD-WAN managed edge charge', 'Recurring', CONVERT(decimal(18,2), 1800.00) FROM billing.BillingCodes bc WHERE bc.Code = 'SDW-MRC'
  UNION ALL SELECT CONVERT(uniqueidentifier, '55555555-5555-4555-8555-555555555555'), bc.BillingCodeId, 'IoT SIM access charge', 'Recurring', CONVERT(decimal(18,2), 22.00) FROM billing.BillingCodes bc WHERE bc.Code = 'IOT-SIM'
  UNION ALL SELECT CONVERT(uniqueidentifier, '66666666-6666-4666-8666-666666666666'), bc.BillingCodeId, 'Managed router recurring charge', 'Recurring', CONVERT(decimal(18,2), 140.00) FROM billing.BillingCodes bc WHERE bc.Code = 'CPE-MRC'
  UNION ALL SELECT CONVERT(uniqueidentifier, '77777777-7777-4777-8777-777777777777'), bc.BillingCodeId, 'Wireless backup recurring charge', 'Recurring', CONVERT(decimal(18,2), 160.00) FROM billing.BillingCodes bc WHERE bc.Code = 'WLS-BACKUP'
) AS source (BillingElementId, BillingCodeId, ElementName, ElementType, Amount)
ON target.BillingElementId = source.BillingElementId
WHEN MATCHED THEN
  UPDATE SET
    BillingCodeId = source.BillingCodeId,
    ElementName = source.ElementName,
    ElementType = source.ElementType,
    Amount = source.Amount,
    UpdatedAtUtc = SYSUTCDATETIME(),
    IsDeleted = 0
WHEN NOT MATCHED THEN
  INSERT (BillingElementId, BillingCodeId, ElementName, ElementType, Amount)
  VALUES (source.BillingElementId, source.BillingCodeId, source.ElementName, source.ElementType, source.Amount);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ops_Orders_StatusCreated' AND object_id = OBJECT_ID('ops.Orders'))
  CREATE INDEX IX_ops_Orders_StatusCreated ON ops.Orders (IsDeleted, OverallStatus, CreatedAtUtc DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ops_ProvisioningJobs_StatusCreated' AND object_id = OBJECT_ID('ops.ProvisioningJobs'))
  CREATE INDEX IX_ops_ProvisioningJobs_StatusCreated ON ops.ProvisioningJobs (IsDeleted, Status, CreatedAtUtc DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ops_NetworkEvents_StatusCreated' AND object_id = OBJECT_ID('ops.NetworkEvents'))
  CREATE INDEX IX_ops_NetworkEvents_StatusCreated ON ops.NetworkEvents (IsDeleted, Status, CreatedAtUtc DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_billingops_Invoices_CustomerStatus' AND object_id = OBJECT_ID('billingops.Invoices'))
  CREATE INDEX IX_billingops_Invoices_CustomerStatus ON billingops.Invoices (IsDeleted, CustomerNumber, Status, InvoiceDate DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_care_Tickets_CustomerStatus' AND object_id = OBJECT_ID('care.Tickets'))
  CREATE INDEX IX_care_Tickets_CustomerStatus ON care.Tickets (IsDeleted, CustomerNumber, Status, CreatedAtUtc DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_knowledge_Documents_StatusUpdated' AND object_id = OBJECT_ID('knowledge.Documents'))
  CREATE INDEX IX_knowledge_Documents_StatusUpdated ON knowledge.Documents (IsDeleted, Status, UpdatedDate DESC);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId = 'fc-gpt-phase2-schema-hardening')
BEGIN
  INSERT INTO dbo.SchemaMigrations (MigrationId, Description)
  VALUES ('fc-gpt-phase2-schema-hardening', 'Source-controlled operational, report, knowledge, billing element, and index readiness migration.');
END;
GO
