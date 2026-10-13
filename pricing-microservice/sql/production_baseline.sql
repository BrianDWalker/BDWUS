-- Schema-only snapshot of AZBDWUSP, 12 October 2026. No customer data.

-- Used to build isolated dev. Never apply this baseline to production.

IF SCHEMA_ID(N'admin') IS NULL EXEC(N'CREATE SCHEMA [admin]');
GO

IF SCHEMA_ID(N'ai') IS NULL EXEC(N'CREATE SCHEMA [ai]');
GO

IF SCHEMA_ID(N'billing') IS NULL EXEC(N'CREATE SCHEMA [billing]');
GO

IF SCHEMA_ID(N'billingops') IS NULL EXEC(N'CREATE SCHEMA [billingops]');
GO

IF SCHEMA_ID(N'care') IS NULL EXEC(N'CREATE SCHEMA [care]');
GO

IF SCHEMA_ID(N'knowledge') IS NULL EXEC(N'CREATE SCHEMA [knowledge]');
GO

IF SCHEMA_ID(N'ms') IS NULL EXEC(N'CREATE SCHEMA [ms]');
GO

IF SCHEMA_ID(N'ops') IS NULL EXEC(N'CREATE SCHEMA [ops]');
GO

IF SCHEMA_ID(N'report') IS NULL EXEC(N'CREATE SCHEMA [report]');
GO

IF OBJECT_ID(N'[admin].[Integrations]', 'U') IS NULL
CREATE TABLE [admin].[Integrations] (
  [IntegrationId] uniqueidentifier NOT NULL,
  [IntegrationNumber] nvarchar(32) NOT NULL,
  [IntegrationName] nvarchar(200) NOT NULL,
  [OwnerName] nvarchar(200) NULL,
  [Status] nvarchar(50) NOT NULL,
  [Detail] nvarchar(400) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[admin].[Roles]', 'U') IS NULL
CREATE TABLE [admin].[Roles] (
  [RoleId] uniqueidentifier NOT NULL,
  [RoleNumber] nvarchar(32) NOT NULL,
  [RoleName] nvarchar(200) NOT NULL,
  [PermissionsJson] nvarchar(MAX) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[admin].[Users]', 'U') IS NULL
CREATE TABLE [admin].[Users] (
  [UserId] uniqueidentifier NOT NULL,
  [UserNumber] nvarchar(32) NOT NULL,
  [UserName] nvarchar(200) NOT NULL,
  [Email] nvarchar(200) NULL,
  [RoleName] nvarchar(200) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [LastLoginAtUtc] datetime2(7) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ai].[AuditLog]', 'U') IS NULL
CREATE TABLE [ai].[AuditLog] (
  [AuditId] uniqueidentifier NOT NULL,
  [EventType] nvarchar(100) NOT NULL,
  [EntityType] nvarchar(100) NOT NULL,
  [EntityId] nvarchar(100) NOT NULL,
  [DetailsJson] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL
);
GO

IF OBJECT_ID(N'[ai].[ChangeRequests]', 'U') IS NULL
CREATE TABLE [ai].[ChangeRequests] (
  [ChangeRequestId] uniqueidentifier NOT NULL,
  [ConversationId] nvarchar(64) NOT NULL,
  [RequestedBy] nvarchar(128) NULL,
  [Mode] nvarchar(32) NOT NULL,
  [Page] nvarchar(64) NOT NULL,
  [Title] nvarchar(200) NOT NULL,
  [Summary] nvarchar(MAX) NOT NULL,
  [Target] nvarchar(200) NOT NULL,
  [Kind] nvarchar(50) NOT NULL,
  [PatchJson] nvarchar(MAX) NOT NULL,
  [Status] nvarchar(32) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL,
  [ApprovedAtUtc] datetime2(7) NULL,
  [ApprovedBy] nvarchar(128) NULL,
  [AppliedAtUtc] datetime2(7) NULL,
  [AppliedBy] nvarchar(128) NULL
);
GO

IF OBJECT_ID(N'[ai].[Conversations]', 'U') IS NULL
CREATE TABLE [ai].[Conversations] (
  [ConversationId] nvarchar(64) NOT NULL,
  [Mode] nvarchar(32) NOT NULL,
  [Page] nvarchar(64) NOT NULL,
  [CreatedBy] nvarchar(128) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL,
  [LastMessageAtUtc] datetime2(7) NULL
);
GO

IF OBJECT_ID(N'[ai].[Messages]', 'U') IS NULL
CREATE TABLE [ai].[Messages] (
  [MessageId] uniqueidentifier NOT NULL,
  [ConversationId] nvarchar(64) NOT NULL,
  [Role] nvarchar(20) NOT NULL,
  [Content] nvarchar(MAX) NOT NULL,
  [MetadataJson] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL
);
GO

IF OBJECT_ID(N'[ai].[UiOverrides]', 'U') IS NULL
CREATE TABLE [ai].[UiOverrides] (
  [OverrideId] uniqueidentifier NOT NULL,
  [ChangeRequestId] uniqueidentifier NOT NULL,
  [Scope] nvarchar(64) NOT NULL,
  [TargetKey] nvarchar(200) NOT NULL,
  [ValueJson] nvarchar(MAX) NOT NULL,
  [Active] bit NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL
);
GO

IF OBJECT_ID(N'[billing].[BillingCodes]', 'U') IS NULL
CREATE TABLE [billing].[BillingCodes] (
  [BillingCodeId] uniqueidentifier NOT NULL,
  [Code] nvarchar(50) NOT NULL,
  [Description] nvarchar(200) NOT NULL,
  [BillingType] nvarchar(100) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[BillingElements]', 'U') IS NULL
CREATE TABLE [billing].[BillingElements] (
  [BillingElementId] uniqueidentifier NOT NULL,
  [BillingCodeId] uniqueidentifier NOT NULL,
  [ElementName] nvarchar(200) NOT NULL,
  [ElementType] nvarchar(100) NOT NULL,
  [Amount] decimal(18,2) NOT NULL DEFAULT ((0)),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[CustomerProfiles]', 'U') IS NULL
CREATE TABLE [billing].[CustomerProfiles] (
  [CustomerProfileId] uniqueidentifier NOT NULL DEFAULT (newid()),
  [CustomerNumber] nvarchar(32) NOT NULL,
  [AccountManager] nvarchar(200) NULL,
  [Segment] nvarchar(100) NULL,
  [SupportTier] nvarchar(100) NULL,
  [Notes] nvarchar(MAX) NULL,
  [ProfileJson] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[Customers]', 'U') IS NULL
CREATE TABLE [billing].[Customers] (
  [CustomerNumber] nvarchar(32) NOT NULL,
  [CustomerName] nvarchar(200) NOT NULL,
  [CustomerType] nvarchar(50) NOT NULL,
  [Industry] nvarchar(100) NOT NULL,
  [Region] nvarchar(100) NOT NULL,
  [CountryCode] nvarchar(10) NOT NULL,
  [Status] nvarchar(30) NOT NULL,
  [CreditRating] int NULL,
  [BillingProfile] nvarchar(200) NULL,
  [PrimaryContact] nvarchar(200) NULL,
  [Mrr] decimal(18,2) NOT NULL DEFAULT ((0)),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0)),
  [CustomerDataJson] nvarchar(MAX) NULL
);
GO

IF OBJECT_ID(N'[billing].[Offers]', 'U') IS NULL
CREATE TABLE [billing].[Offers] (
  [OfferId] uniqueidentifier NOT NULL,
  [OfferCode] nvarchar(50) NOT NULL,
  [OfferName] nvarchar(200) NOT NULL,
  [OfferType] nvarchar(100) NOT NULL,
  [Eligibility] nvarchar(200) NULL,
  [DiscountDescription] nvarchar(200) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[ProductHierarchy]', 'U') IS NULL
CREATE TABLE [billing].[ProductHierarchy] (
  [ProductHierarchyId] uniqueidentifier NOT NULL,
  [ProductId] uniqueidentifier NOT NULL,
  [ParentProductId] uniqueidentifier NULL,
  [HierarchyPath] nvarchar(400) NOT NULL,
  [DisplayOrder] int NOT NULL DEFAULT ((0)),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[billing].[Products]', 'U') IS NULL
CREATE TABLE [billing].[Products] (
  [ProductId] uniqueidentifier NOT NULL,
  [ProductCode] nvarchar(50) NOT NULL,
  [ProductName] nvarchar(200) NOT NULL,
  [Category] nvarchar(100) NOT NULL,
  [ServiceCategory] nvarchar(100) NULL,
  [BillingCode] nvarchar(50) NOT NULL,
  [BaseMrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [BaseNrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[Promotions]', 'U') IS NULL
CREATE TABLE [billing].[Promotions] (
  [PromotionId] uniqueidentifier NOT NULL,
  [PromotionCode] nvarchar(50) NOT NULL,
  [PromotionName] nvarchar(200) NOT NULL,
  [PromotionType] nvarchar(100) NOT NULL,
  [DiscountPct] decimal(9,2) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[RatePlans]', 'U') IS NULL
CREATE TABLE [billing].[RatePlans] (
  [RatePlanId] uniqueidentifier NOT NULL,
  [ProductId] uniqueidentifier NOT NULL,
  [PlanCode] nvarchar(50) NOT NULL,
  [PlanName] nvarchar(200) NOT NULL,
  [PlanTier] nvarchar(100) NOT NULL,
  [BillingFrequency] nvarchar(50) NOT NULL,
  [IncludedUnits] int NOT NULL DEFAULT ((0)),
  [OveragePricePerUnit] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MonthlyBaseFee] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MinimumCommitment] decimal(18,2) NOT NULL DEFAULT ((0)),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[ServiceLocations]', 'U') IS NULL
CREATE TABLE [billing].[ServiceLocations] (
  [ServiceLocationId] uniqueidentifier NOT NULL,
  [CustomerNumber] nvarchar(32) NOT NULL,
  [LocationName] nvarchar(200) NOT NULL,
  [AddressLine1] nvarchar(200) NOT NULL,
  [City] nvarchar(100) NOT NULL,
  [StateProvince] nvarchar(100) NOT NULL,
  [PostalCode] nvarchar(20) NOT NULL,
  [CountryCode] nvarchar(10) NOT NULL,
  [ServiceabilityType] nvarchar(100) NOT NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billing].[Services]', 'U') IS NULL
CREATE TABLE [billing].[Services] (
  [ServiceId] uniqueidentifier NOT NULL,
  [ServiceCode] nvarchar(50) NOT NULL,
  [ServiceName] nvarchar(200) NOT NULL,
  [Category] nvarchar(100) NOT NULL,
  [ServiceabilityType] nvarchar(100) NULL,
  [BillingCode] nvarchar(50) NOT NULL,
  [BaseMrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [BaseNrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billingops].[Adjustments]', 'U') IS NULL
CREATE TABLE [billingops].[Adjustments] (
  [AdjustmentId] uniqueidentifier NOT NULL,
  [InvoiceId] uniqueidentifier NULL,
  [AdjustmentNumber] nvarchar(32) NOT NULL,
  [AdjustmentType] nvarchar(100) NOT NULL,
  [Amount] decimal(18,2) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [Reason] nvarchar(MAX) NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billingops].[InvoiceActions]', 'U') IS NULL
CREATE TABLE [billingops].[InvoiceActions] (
  [InvoiceActionId] uniqueidentifier NOT NULL,
  [InvoiceId] uniqueidentifier NOT NULL,
  [ActionType] nvarchar(100) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [RequestedBy] nvarchar(200) NULL,
  [Notes] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[billingops].[Invoices]', 'U') IS NULL
CREATE TABLE [billingops].[Invoices] (
  [InvoiceId] uniqueidentifier NOT NULL,
  [InvoiceNumber] nvarchar(32) NOT NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [AccountName] nvarchar(200) NOT NULL,
  [Amount] decimal(18,2) NOT NULL,
  [Balance] decimal(18,2) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [InvoiceDate] date NULL,
  [DueDate] date NULL,
  [BillingProfile] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[care].[TicketNotes]', 'U') IS NULL
CREATE TABLE [care].[TicketNotes] (
  [TicketNoteId] uniqueidentifier NOT NULL,
  [TicketId] uniqueidentifier NOT NULL,
  [NoteType] nvarchar(100) NOT NULL,
  [Note] nvarchar(MAX) NOT NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[care].[Tickets]', 'U') IS NULL
CREATE TABLE [care].[Tickets] (
  [TicketId] uniqueidentifier NOT NULL,
  [TicketNumber] nvarchar(32) NOT NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [AccountName] nvarchar(200) NOT NULL,
  [IssueType] nvarchar(200) NOT NULL,
  [Category] nvarchar(100) NOT NULL,
  [Priority] nvarchar(50) NOT NULL,
  [Status] nvarchar(50) NOT NULL,
  [OwnerName] nvarchar(200) NULL,
  [Summary] nvarchar(MAX) NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0)),
  [EscalationLevel] nvarchar(50) NULL,
  [SlaTargetHours] int NULL,
  [ClosureReason] nvarchar(400) NULL,
  [ClosedAtUtc] datetime2(7) NULL
);
GO

IF OBJECT_ID(N'[dbo].[BuildVersion]', 'U') IS NULL
CREATE TABLE [dbo].[BuildVersion] (
  [SystemInformationID] tinyint IDENTITY(1,1) NOT NULL,
  [Database Version] nvarchar(25) NOT NULL,
  [VersionDate] datetime NOT NULL,
  [ModifiedDate] datetime NOT NULL DEFAULT (getdate())
);
GO

IF OBJECT_ID(N'[dbo].[ErrorLog]', 'U') IS NULL
CREATE TABLE [dbo].[ErrorLog] (
  [ErrorLogID] int IDENTITY(1,1) NOT NULL,
  [ErrorTime] datetime NOT NULL DEFAULT (getdate()),
  [UserName] sysname NOT NULL,
  [ErrorNumber] int NOT NULL,
  [ErrorSeverity] int NULL,
  [ErrorState] int NULL,
  [ErrorProcedure] nvarchar(126) NULL,
  [ErrorLine] int NULL,
  [ErrorMessage] nvarchar(4000) NOT NULL
);
GO

IF OBJECT_ID(N'[dbo].[SchemaMigrations]', 'U') IS NULL
CREATE TABLE [dbo].[SchemaMigrations] (
  [MigrationId] nvarchar(120) NOT NULL,
  [Description] nvarchar(400) NOT NULL,
  [AppliedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[knowledge].[Documents]', 'U') IS NULL
CREATE TABLE [knowledge].[Documents] (
  [DocumentId] nvarchar(40) NOT NULL,
  [Title] nvarchar(250) NOT NULL,
  [Category] nvarchar(100) NOT NULL,
  [Audience] nvarchar(250) NULL,
  [UpdatedDate] date NULL,
  [OwnerName] nvarchar(200) NULL,
  [Summary] nvarchar(MAX) NOT NULL,
  [SourceUrl] nvarchar(500) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[knowledge].[DocumentTopics]', 'U') IS NULL
CREATE TABLE [knowledge].[DocumentTopics] (
  [DocumentId] nvarchar(40) NOT NULL,
  [TopicId] nvarchar(40) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[knowledge].[Topics]', 'U') IS NULL
CREATE TABLE [knowledge].[Topics] (
  [TopicId] nvarchar(40) NOT NULL,
  [TopicName] nvarchar(200) NOT NULL,
  [Description] nvarchar(500) NOT NULL,
  [SortOrder] int NOT NULL DEFAULT ((0)),
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[Accounts]', 'U') IS NULL
CREATE TABLE [ms].[Accounts] (
  [AccountId] uniqueidentifier NOT NULL,
  [AccountNumber] nvarchar(32) NOT NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [AccountName] nvarchar(200) NOT NULL,
  [Segment] nvarchar(100) NULL,
  [Region] nvarchar(100) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [OwnerName] nvarchar(200) NULL,
  [Mrr] decimal(18,2) NOT NULL DEFAULT ((0)),
  [CustomerInfoJson] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[Approvals]', 'U') IS NULL
CREATE TABLE [ms].[Approvals] (
  [ApprovalId] uniqueidentifier NOT NULL,
  [EntityType] nvarchar(50) NOT NULL,
  [EntityId] uniqueidentifier NOT NULL,
  [ApprovalType] nvarchar(50) NULL,
  [StepName] nvarchar(100) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Pending'),
  [RequestedBy] nvarchar(200) NULL,
  [ApprovedBy] nvarchar(200) NULL,
  [RejectionReason] nvarchar(MAX) NULL,
  [RequestedChanges] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[ms].[ContractFiles]', 'U') IS NULL
CREATE TABLE [ms].[ContractFiles] (
  [ContractFileId] uniqueidentifier NOT NULL,
  [ContractId] uniqueidentifier NOT NULL,
  [FileName] nvarchar(200) NOT NULL,
  [FileType] nvarchar(50) NOT NULL,
  [StorageUrl] nvarchar(500) NULL,
  [FileSizeBytes] bigint NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[ContractHistory]', 'U') IS NULL
CREATE TABLE [ms].[ContractHistory] (
  [ContractHistoryId] uniqueidentifier NOT NULL,
  [ContractId] uniqueidentifier NOT NULL,
  [EventType] nvarchar(100) NOT NULL,
  [Notes] nvarchar(MAX) NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[ms].[Contracts]', 'U') IS NULL
CREATE TABLE [ms].[Contracts] (
  [ContractId] uniqueidentifier NOT NULL,
  [ContractNumber] nvarchar(32) NOT NULL,
  [OpportunityId] uniqueidentifier NOT NULL,
  [QuoteId] uniqueidentifier NULL,
  [ContractName] nvarchar(200) NOT NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Open'),
  [TermsJson] nvarchar(MAX) NULL,
  [SignedDate] date NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[CustomPricingRequests]', 'U') IS NULL
CREATE TABLE [ms].[CustomPricingRequests] (
  [CustomPricingRequestId] uniqueidentifier NOT NULL,
  [QuoteId] uniqueidentifier NULL,
  [OpportunityId] uniqueidentifier NULL,
  [RequestNumber] nvarchar(32) NOT NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Draft'),
  [Reason] nvarchar(MAX) NULL,
  [RequestedBy] nvarchar(200) NULL,
  [SubmittedAtUtc] datetime2(7) NULL,
  [ApprovedAtUtc] datetime2(7) NULL,
  [RejectedAtUtc] datetime2(7) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[LeadActivities]', 'U') IS NULL
CREATE TABLE [ms].[LeadActivities] (
  [LeadActivityId] uniqueidentifier NOT NULL,
  [LeadId] uniqueidentifier NOT NULL,
  [ActivityDate] datetime2(7) NOT NULL,
  [ActivityType] nvarchar(50) NOT NULL,
  [Outcome] nvarchar(100) NULL,
  [Notes] nvarchar(MAX) NULL,
  [NextStep] nvarchar(200) NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[Leads]', 'U') IS NULL
CREATE TABLE [ms].[Leads] (
  [LeadId] uniqueidentifier NOT NULL,
  [LeadNumber] nvarchar(32) NOT NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [AccountName] nvarchar(200) NOT NULL,
  [ContactName] nvarchar(200) NULL,
  [Source] nvarchar(100) NULL,
  [Qualification] nvarchar(100) NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Open'),
  [EstimatedValue] decimal(18,2) NOT NULL DEFAULT ((0)),
  [OwnerName] nvarchar(200) NULL,
  [ProductInterest] nvarchar(200) NULL,
  [ServiceNeedsJson] nvarchar(MAX) NULL,
  [CustomerInfoJson] nvarchar(MAX) NULL,
  [Notes] nvarchar(MAX) NULL,
  [ConvertedOpportunityId] uniqueidentifier NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[Opportunities]', 'U') IS NULL
CREATE TABLE [ms].[Opportunities] (
  [OpportunityId] uniqueidentifier NOT NULL,
  [OpportunityNumber] nvarchar(32) NOT NULL,
  [LeadId] uniqueidentifier NULL,
  [AccountId] uniqueidentifier NOT NULL,
  [OpportunityName] nvarchar(200) NOT NULL,
  [Stage] nvarchar(100) NOT NULL DEFAULT ('Discovery'),
  [Status] nvarchar(30) NOT NULL DEFAULT ('Open'),
  [OwnerName] nvarchar(200) NULL,
  [CloseDate] date NULL,
  [EstimatedValue] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MarginPct] decimal(9,2) NULL,
  [LocationCount] int NULL,
  [ProductSummary] nvarchar(400) NULL,
  [ServiceSummary] nvarchar(400) NULL,
  [ApprovalStatus] nvarchar(100) NULL,
  [ConvertedFromLeadId] uniqueidentifier NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[OpportunityNotes]', 'U') IS NULL
CREATE TABLE [ms].[OpportunityNotes] (
  [OpportunityNoteId] uniqueidentifier NOT NULL,
  [OpportunityId] uniqueidentifier NOT NULL,
  [NoteType] nvarchar(50) NOT NULL,
  [Note] nvarchar(MAX) NOT NULL,
  [CreatedBy] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[OpportunityProducts]', 'U') IS NULL
CREATE TABLE [ms].[OpportunityProducts] (
  [OpportunityProductId] uniqueidentifier NOT NULL,
  [OpportunityId] uniqueidentifier NOT NULL,
  [ProductId] uniqueidentifier NULL,
  [ProductName] nvarchar(200) NOT NULL,
  [BillingCode] nvarchar(50) NULL,
  [Quantity] int NOT NULL DEFAULT ((1)),
  [Mrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Nrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Cost] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MarginPct] decimal(9,2) NULL,
  [ServiceId] uniqueidentifier NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[OpportunityServices]', 'U') IS NULL
CREATE TABLE [ms].[OpportunityServices] (
  [OpportunityServiceId] uniqueidentifier NOT NULL,
  [OpportunityId] uniqueidentifier NOT NULL,
  [ServiceId] uniqueidentifier NULL,
  [ServiceName] nvarchar(200) NOT NULL,
  [ServiceDescription] nvarchar(MAX) NULL,
  [LocationCount] int NULL,
  [Serviceability] nvarchar(100) NULL,
  [IsPrimary] bit NOT NULL DEFAULT ((0)),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[PricingInputs]', 'U') IS NULL
CREATE TABLE [ms].[PricingInputs] (
  [PricingInputId] uniqueidentifier NOT NULL,
  [QuoteId] uniqueidentifier NOT NULL,
  [InputJson] nvarchar(MAX) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[ms].[PricingResults]', 'U') IS NULL
CREATE TABLE [ms].[PricingResults] (
  [PricingResultId] uniqueidentifier NOT NULL,
  [QuoteId] uniqueidentifier NOT NULL,
  [ResultJson] nvarchar(MAX) NOT NULL,
  [RecommendedPrice] decimal(18,2) NULL,
  [ExpectedMarginPct] decimal(9,2) NULL,
  [FinalPrice] decimal(18,2) NULL,
  [Score] decimal(9,2) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[ms].[QuoteLineItems]', 'U') IS NULL
CREATE TABLE [ms].[QuoteLineItems] (
  [QuoteLineItemId] uniqueidentifier NOT NULL,
  [QuoteId] uniqueidentifier NOT NULL,
  [ProductId] uniqueidentifier NULL,
  [ServiceId] uniqueidentifier NULL,
  [ProductName] nvarchar(200) NOT NULL,
  [ServiceName] nvarchar(200) NULL,
  [BillingCode] nvarchar(50) NULL,
  [LineType] nvarchar(50) NOT NULL,
  [Quantity] int NOT NULL DEFAULT ((1)),
  [Mrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Nrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Cost] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MarginPct] decimal(9,2) NULL,
  [DiscountPct] decimal(9,2) NULL,
  [Notes] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[Quotes]', 'U') IS NULL
CREATE TABLE [ms].[Quotes] (
  [QuoteId] uniqueidentifier NOT NULL,
  [QuoteNumber] nvarchar(32) NOT NULL,
  [OpportunityId] uniqueidentifier NOT NULL,
  [Status] nvarchar(30) NOT NULL DEFAULT ('Draft'),
  [VersionNo] int NOT NULL DEFAULT ((1)),
  [TotalMrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [TotalNrc] decimal(18,2) NOT NULL DEFAULT ((0)),
  [MarginPct] decimal(9,2) NULL,
  [DiscountPct] decimal(9,2) NULL,
  [ManualAdjustmentPct] decimal(9,2) NULL,
  [ApprovalStatus] nvarchar(100) NULL,
  [CustomPricingRequestId] uniqueidentifier NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ms].[ServiceabilityChecks]', 'U') IS NULL
CREATE TABLE [ms].[ServiceabilityChecks] (
  [ServiceabilityCheckId] uniqueidentifier NOT NULL,
  [LeadId] uniqueidentifier NULL,
  [OpportunityId] uniqueidentifier NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [LocationName] nvarchar(200) NOT NULL,
  [AddressLine1] nvarchar(200) NULL,
  [City] nvarchar(100) NULL,
  [StateProvince] nvarchar(100) NULL,
  [PostalCode] nvarchar(20) NULL,
  [ResultStatus] nvarchar(30) NOT NULL,
  [ResultJson] nvarchar(MAX) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime())
);
GO

IF OBJECT_ID(N'[ops].[NetworkEvents]', 'U') IS NULL
CREATE TABLE [ops].[NetworkEvents] (
  [EventId] uniqueidentifier NOT NULL,
  [EventNumber] nvarchar(32) NOT NULL,
  [Market] nvarchar(100) NOT NULL,
  [Type] nvarchar(100) NOT NULL,
  [Impacted] nvarchar(200) NOT NULL,
  [Severity] nvarchar(50) NOT NULL,
  [SlaExposure] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Status] nvarchar(50) NOT NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ops].[Orders]', 'U') IS NULL
CREATE TABLE [ops].[Orders] (
  [OrderId] uniqueidentifier NOT NULL,
  [OrderNumber] nvarchar(32) NOT NULL,
  [CustomerNumber] nvarchar(32) NULL,
  [AccountName] nvarchar(200) NOT NULL,
  [ServiceName] nvarchar(200) NOT NULL,
  [LifecycleStage] nvarchar(100) NOT NULL,
  [OverallStatus] nvarchar(100) NOT NULL,
  [SlaStatus] nvarchar(100) NOT NULL,
  [DueDate] date NULL,
  [AssignedTeam] nvarchar(200) NULL,
  [CircuitId] nvarchar(64) NULL,
  [Location] nvarchar(200) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0)),
  [UpdatedAtUtc] datetime2(7) NULL
);
GO

IF OBJECT_ID(N'[ops].[ProvisioningJobs]', 'U') IS NULL
CREATE TABLE [ops].[ProvisioningJobs] (
  [ProvisioningJobId] uniqueidentifier NOT NULL,
  [OrderId] uniqueidentifier NULL,
  [JobNumber] nvarchar(32) NOT NULL,
  [JobType] nvarchar(100) NOT NULL,
  [OwnerName] nvarchar(200) NULL,
  [Status] nvarchar(50) NOT NULL,
  [DueDate] date NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[ops].[Settlements]', 'U') IS NULL
CREATE TABLE [ops].[Settlements] (
  [SettlementId] uniqueidentifier NOT NULL,
  [SettlementNumber] nvarchar(32) NOT NULL,
  [PartnerName] nvarchar(200) NOT NULL,
  [BillingPeriod] nvarchar(32) NOT NULL,
  [ExposureAmount] decimal(18,2) NOT NULL DEFAULT ((0)),
  [Status] nvarchar(50) NOT NULL,
  [ClaimType] nvarchar(100) NULL,
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NULL,
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF OBJECT_ID(N'[report].[ReportDefinitions]', 'U') IS NULL
CREATE TABLE [report].[ReportDefinitions] (
  [ReportId] nvarchar(80) NOT NULL,
  [ReportName] nvarchar(200) NOT NULL,
  [Area] nvarchar(100) NOT NULL,
  [Description] nvarchar(500) NOT NULL,
  [SortOrder] int NOT NULL DEFAULT ((0)),
  [Status] nvarchar(30) NOT NULL DEFAULT ('Active'),
  [CreatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [UpdatedAtUtc] datetime2(7) NOT NULL DEFAULT (sysutcdatetime()),
  [IsDeleted] bit NOT NULL DEFAULT ((0))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[admin].[Integrations]') AND name=N'PK__Integrat__D89568351F1CE78E')
ALTER TABLE [admin].[Integrations] ADD CONSTRAINT [PK__Integrat__D89568351F1CE78E] PRIMARY KEY CLUSTERED ([IntegrationId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[admin].[Roles]') AND name=N'PK__Roles__8AFACE1A2970EFEC')
ALTER TABLE [admin].[Roles] ADD CONSTRAINT [PK__Roles__8AFACE1A2970EFEC] PRIMARY KEY CLUSTERED ([RoleId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[admin].[Users]') AND name=N'PK__Users__1788CC4CF11004A1')
ALTER TABLE [admin].[Users] ADD CONSTRAINT [PK__Users__1788CC4CF11004A1] PRIMARY KEY CLUSTERED ([UserId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[AuditLog]') AND name=N'PK__AuditLog__A17F239870C6EC21')
ALTER TABLE [ai].[AuditLog] ADD CONSTRAINT [PK__AuditLog__A17F239870C6EC21] PRIMARY KEY CLUSTERED ([AuditId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[ChangeRequests]') AND name=N'PK__ChangeRe__AA1AE55F8F25EA64')
ALTER TABLE [ai].[ChangeRequests] ADD CONSTRAINT [PK__ChangeRe__AA1AE55F8F25EA64] PRIMARY KEY CLUSTERED ([ChangeRequestId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[ChangeRequests]') AND name=N'IX_ai_ChangeRequests_Status')
CREATE NONCLUSTERED INDEX [IX_ai_ChangeRequests_Status] ON [ai].[ChangeRequests] ([Status] ASC, [CreatedAtUtc] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[Conversations]') AND name=N'PK__Conversa__C050D8773A41AD92')
ALTER TABLE [ai].[Conversations] ADD CONSTRAINT [PK__Conversa__C050D8773A41AD92] PRIMARY KEY CLUSTERED ([ConversationId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[Messages]') AND name=N'PK__Messages__C87C0C9C1F2C942B')
ALTER TABLE [ai].[Messages] ADD CONSTRAINT [PK__Messages__C87C0C9C1F2C942B] PRIMARY KEY CLUSTERED ([MessageId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[Messages]') AND name=N'IX_ai_Messages_ConversationId')
CREATE NONCLUSTERED INDEX [IX_ai_Messages_ConversationId] ON [ai].[Messages] ([ConversationId] ASC, [CreatedAtUtc] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[UiOverrides]') AND name=N'PK__UiOverri__37B51224CB227AA4')
ALTER TABLE [ai].[UiOverrides] ADD CONSTRAINT [PK__UiOverri__37B51224CB227AA4] PRIMARY KEY CLUSTERED ([OverrideId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ai].[UiOverrides]') AND name=N'IX_ai_UiOverrides_Scope')
CREATE NONCLUSTERED INDEX [IX_ai_UiOverrides_Scope] ON [ai].[UiOverrides] ([Scope] ASC, [Active] ASC, [CreatedAtUtc] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[BillingCodes]') AND name=N'PK__BillingC__F7696EA9480801B1')
ALTER TABLE [billing].[BillingCodes] ADD CONSTRAINT [PK__BillingC__F7696EA9480801B1] PRIMARY KEY CLUSTERED ([BillingCodeId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[BillingElements]') AND name=N'PK__BillingE__D2B0221843ED0382')
ALTER TABLE [billing].[BillingElements] ADD CONSTRAINT [PK__BillingE__D2B0221843ED0382] PRIMARY KEY CLUSTERED ([BillingElementId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[CustomerProfiles]') AND name=N'PK__Customer__E4ABBFABFE842813')
ALTER TABLE [billing].[CustomerProfiles] ADD CONSTRAINT [PK__Customer__E4ABBFABFE842813] PRIMARY KEY CLUSTERED ([CustomerProfileId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[Customers]') AND name=N'PK__Customer__48D47E1FCB618388')
ALTER TABLE [billing].[Customers] ADD CONSTRAINT [PK__Customer__48D47E1FCB618388] PRIMARY KEY CLUSTERED ([CustomerNumber] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[Offers]') AND name=N'PK__Offers__8EBCF091C6973ED3')
ALTER TABLE [billing].[Offers] ADD CONSTRAINT [PK__Offers__8EBCF091C6973ED3] PRIMARY KEY CLUSTERED ([OfferId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[ProductHierarchy]') AND name=N'PK__ProductH__8933015F9878F945')
ALTER TABLE [billing].[ProductHierarchy] ADD CONSTRAINT [PK__ProductH__8933015F9878F945] PRIMARY KEY CLUSTERED ([ProductHierarchyId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[Products]') AND name=N'PK__Products__B40CC6CD00E8E2EE')
ALTER TABLE [billing].[Products] ADD CONSTRAINT [PK__Products__B40CC6CD00E8E2EE] PRIMARY KEY CLUSTERED ([ProductId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[Promotions]') AND name=N'PK__Promotio__52C42FCF8EC06547')
ALTER TABLE [billing].[Promotions] ADD CONSTRAINT [PK__Promotio__52C42FCF8EC06547] PRIMARY KEY CLUSTERED ([PromotionId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[RatePlans]') AND name=N'PK__RatePlan__15F1691AD648D9DC')
ALTER TABLE [billing].[RatePlans] ADD CONSTRAINT [PK__RatePlan__15F1691AD648D9DC] PRIMARY KEY CLUSTERED ([RatePlanId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[ServiceLocations]') AND name=N'PK__ServiceL__3255B7509FED61E7')
ALTER TABLE [billing].[ServiceLocations] ADD CONSTRAINT [PK__ServiceL__3255B7509FED61E7] PRIMARY KEY CLUSTERED ([ServiceLocationId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billing].[Services]') AND name=N'PK__Services__C51BB00A600D86F2')
ALTER TABLE [billing].[Services] ADD CONSTRAINT [PK__Services__C51BB00A600D86F2] PRIMARY KEY CLUSTERED ([ServiceId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billingops].[Adjustments]') AND name=N'PK__Adjustme__E60DB893DFC5C103')
ALTER TABLE [billingops].[Adjustments] ADD CONSTRAINT [PK__Adjustme__E60DB893DFC5C103] PRIMARY KEY CLUSTERED ([AdjustmentId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billingops].[InvoiceActions]') AND name=N'PK__InvoiceA__AC9DA89D73BE0FBC')
ALTER TABLE [billingops].[InvoiceActions] ADD CONSTRAINT [PK__InvoiceA__AC9DA89D73BE0FBC] PRIMARY KEY CLUSTERED ([InvoiceActionId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billingops].[Invoices]') AND name=N'PK__Invoices__D796AAB5A9A424D0')
ALTER TABLE [billingops].[Invoices] ADD CONSTRAINT [PK__Invoices__D796AAB5A9A424D0] PRIMARY KEY CLUSTERED ([InvoiceId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[billingops].[Invoices]') AND name=N'IX_billingops_Invoices_CustomerStatus')
CREATE NONCLUSTERED INDEX [IX_billingops_Invoices_CustomerStatus] ON [billingops].[Invoices] ([IsDeleted] ASC, [CustomerNumber] ASC, [Status] ASC, [InvoiceDate] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[care].[TicketNotes]') AND name=N'PK__TicketNo__7471491D534F6B7D')
ALTER TABLE [care].[TicketNotes] ADD CONSTRAINT [PK__TicketNo__7471491D534F6B7D] PRIMARY KEY CLUSTERED ([TicketNoteId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[care].[Tickets]') AND name=N'PK__Tickets__712CC607F2282102')
ALTER TABLE [care].[Tickets] ADD CONSTRAINT [PK__Tickets__712CC607F2282102] PRIMARY KEY CLUSTERED ([TicketId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[care].[Tickets]') AND name=N'IX_care_Tickets_CustomerStatus')
CREATE NONCLUSTERED INDEX [IX_care_Tickets_CustomerStatus] ON [care].[Tickets] ([IsDeleted] ASC, [CustomerNumber] ASC, [Status] ASC, [CreatedAtUtc] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[BuildVersion]') AND name=N'PK__BuildVer__35E58ECAD4CF9862')
ALTER TABLE [dbo].[BuildVersion] ADD CONSTRAINT [PK__BuildVer__35E58ECAD4CF9862] PRIMARY KEY CLUSTERED ([SystemInformationID] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ErrorLog]') AND name=N'PK_ErrorLog_ErrorLogID')
ALTER TABLE [dbo].[ErrorLog] ADD CONSTRAINT [PK_ErrorLog_ErrorLogID] PRIMARY KEY CLUSTERED ([ErrorLogID] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[SchemaMigrations]') AND name=N'PK__SchemaMi__E5D3573B5DD2DD10')
ALTER TABLE [dbo].[SchemaMigrations] ADD CONSTRAINT [PK__SchemaMi__E5D3573B5DD2DD10] PRIMARY KEY CLUSTERED ([MigrationId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[knowledge].[Documents]') AND name=N'PK__Document__1ABEEF0FDBD6D352')
ALTER TABLE [knowledge].[Documents] ADD CONSTRAINT [PK__Document__1ABEEF0FDBD6D352] PRIMARY KEY CLUSTERED ([DocumentId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[knowledge].[Documents]') AND name=N'IX_knowledge_Documents_StatusUpdated')
CREATE NONCLUSTERED INDEX [IX_knowledge_Documents_StatusUpdated] ON [knowledge].[Documents] ([IsDeleted] ASC, [Status] ASC, [UpdatedDate] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[knowledge].[DocumentTopics]') AND name=N'PK_knowledge_DocumentTopics')
ALTER TABLE [knowledge].[DocumentTopics] ADD CONSTRAINT [PK_knowledge_DocumentTopics] PRIMARY KEY CLUSTERED ([DocumentId] ASC, [TopicId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[knowledge].[Topics]') AND name=N'PK__Topics__022E0F5D34596E19')
ALTER TABLE [knowledge].[Topics] ADD CONSTRAINT [PK__Topics__022E0F5D34596E19] PRIMARY KEY CLUSTERED ([TopicId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Accounts]') AND name=N'PK__Accounts__349DA5A6BE9DE661')
ALTER TABLE [ms].[Accounts] ADD CONSTRAINT [PK__Accounts__349DA5A6BE9DE661] PRIMARY KEY CLUSTERED ([AccountId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Approvals]') AND name=N'PK__Approval__328477F466363E9B')
ALTER TABLE [ms].[Approvals] ADD CONSTRAINT [PK__Approval__328477F466363E9B] PRIMARY KEY CLUSTERED ([ApprovalId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[ContractFiles]') AND name=N'PK__Contract__7BE71ADADA2C4A3F')
ALTER TABLE [ms].[ContractFiles] ADD CONSTRAINT [PK__Contract__7BE71ADADA2C4A3F] PRIMARY KEY CLUSTERED ([ContractFileId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[ContractHistory]') AND name=N'PK__Contract__40A7E29B83E5EA2A')
ALTER TABLE [ms].[ContractHistory] ADD CONSTRAINT [PK__Contract__40A7E29B83E5EA2A] PRIMARY KEY CLUSTERED ([ContractHistoryId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Contracts]') AND name=N'PK__Contract__C90D34696D497C67')
ALTER TABLE [ms].[Contracts] ADD CONSTRAINT [PK__Contract__C90D34696D497C67] PRIMARY KEY CLUSTERED ([ContractId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[CustomPricingRequests]') AND name=N'PK__CustomPr__DA295FF79FCF825E')
ALTER TABLE [ms].[CustomPricingRequests] ADD CONSTRAINT [PK__CustomPr__DA295FF79FCF825E] PRIMARY KEY CLUSTERED ([CustomPricingRequestId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[LeadActivities]') AND name=N'PK__LeadActi__BA63C0F76AC55858')
ALTER TABLE [ms].[LeadActivities] ADD CONSTRAINT [PK__LeadActi__BA63C0F76AC55858] PRIMARY KEY CLUSTERED ([LeadActivityId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Leads]') AND name=N'PK__Leads__73EF78FACAB766DB')
ALTER TABLE [ms].[Leads] ADD CONSTRAINT [PK__Leads__73EF78FACAB766DB] PRIMARY KEY CLUSTERED ([LeadId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Opportunities]') AND name=N'PK__Opportun__0034ED917CE3F416')
ALTER TABLE [ms].[Opportunities] ADD CONSTRAINT [PK__Opportun__0034ED917CE3F416] PRIMARY KEY CLUSTERED ([OpportunityId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[OpportunityNotes]') AND name=N'PK__Opportun__ED1CFDE8B3D480A5')
ALTER TABLE [ms].[OpportunityNotes] ADD CONSTRAINT [PK__Opportun__ED1CFDE8B3D480A5] PRIMARY KEY CLUSTERED ([OpportunityNoteId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[OpportunityProducts]') AND name=N'PK__Opportun__009228DD3794CCC7')
ALTER TABLE [ms].[OpportunityProducts] ADD CONSTRAINT [PK__Opportun__009228DD3794CCC7] PRIMARY KEY CLUSTERED ([OpportunityProductId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[OpportunityServices]') AND name=N'PK__Opportun__1CA49E9374878E4B')
ALTER TABLE [ms].[OpportunityServices] ADD CONSTRAINT [PK__Opportun__1CA49E9374878E4B] PRIMARY KEY CLUSTERED ([OpportunityServiceId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[PricingInputs]') AND name=N'PK__PricingI__FBBCEAEEC55BB4A4')
ALTER TABLE [ms].[PricingInputs] ADD CONSTRAINT [PK__PricingI__FBBCEAEEC55BB4A4] PRIMARY KEY CLUSTERED ([PricingInputId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[PricingResults]') AND name=N'PK__PricingR__F9553044360D8B2A')
ALTER TABLE [ms].[PricingResults] ADD CONSTRAINT [PK__PricingR__F9553044360D8B2A] PRIMARY KEY CLUSTERED ([PricingResultId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[QuoteLineItems]') AND name=N'PK__QuoteLin__76351D8185A0A494')
ALTER TABLE [ms].[QuoteLineItems] ADD CONSTRAINT [PK__QuoteLin__76351D8185A0A494] PRIMARY KEY CLUSTERED ([QuoteLineItemId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[Quotes]') AND name=N'PK__Quotes__AF9688C1000B86EE')
ALTER TABLE [ms].[Quotes] ADD CONSTRAINT [PK__Quotes__AF9688C1000B86EE] PRIMARY KEY CLUSTERED ([QuoteId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ms].[ServiceabilityChecks]') AND name=N'PK__Servicea__3DCAFA29E781D332')
ALTER TABLE [ms].[ServiceabilityChecks] ADD CONSTRAINT [PK__Servicea__3DCAFA29E781D332] PRIMARY KEY CLUSTERED ([ServiceabilityCheckId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[NetworkEvents]') AND name=N'PK__NetworkE__7944C810C6E33231')
ALTER TABLE [ops].[NetworkEvents] ADD CONSTRAINT [PK__NetworkE__7944C810C6E33231] PRIMARY KEY CLUSTERED ([EventId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[NetworkEvents]') AND name=N'IX_ops_NetworkEvents_StatusCreated')
CREATE NONCLUSTERED INDEX [IX_ops_NetworkEvents_StatusCreated] ON [ops].[NetworkEvents] ([IsDeleted] ASC, [Status] ASC, [CreatedAtUtc] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[Orders]') AND name=N'PK__Orders__C3905BCF974A7090')
ALTER TABLE [ops].[Orders] ADD CONSTRAINT [PK__Orders__C3905BCF974A7090] PRIMARY KEY CLUSTERED ([OrderId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[Orders]') AND name=N'IX_ops_Orders_StatusCreated')
CREATE NONCLUSTERED INDEX [IX_ops_Orders_StatusCreated] ON [ops].[Orders] ([IsDeleted] ASC, [OverallStatus] ASC, [CreatedAtUtc] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[ProvisioningJobs]') AND name=N'PK__Provisio__72C99BF21F345515')
ALTER TABLE [ops].[ProvisioningJobs] ADD CONSTRAINT [PK__Provisio__72C99BF21F345515] PRIMARY KEY CLUSTERED ([ProvisioningJobId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[ProvisioningJobs]') AND name=N'IX_ops_ProvisioningJobs_StatusCreated')
CREATE NONCLUSTERED INDEX [IX_ops_ProvisioningJobs_StatusCreated] ON [ops].[ProvisioningJobs] ([IsDeleted] ASC, [Status] ASC, [CreatedAtUtc] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[ops].[Settlements]') AND name=N'PK__Settleme__7712545A5097314F')
ALTER TABLE [ops].[Settlements] ADD CONSTRAINT [PK__Settleme__7712545A5097314F] PRIMARY KEY CLUSTERED ([SettlementId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[report].[ReportDefinitions]') AND name=N'PK__ReportDe__D5BD480598B52B0A')
ALTER TABLE [report].[ReportDefinitions] ADD CONSTRAINT [PK__ReportDe__D5BD480598B52B0A] PRIMARY KEY CLUSTERED ([ReportId] ASC);
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW billing.vCustomerLookup AS
SELECT
  c.CustomerNumber,
  c.CustomerName,
  c.CustomerType,
  c.Industry,
  c.Region,
  c.CountryCode,
  c.Status AS CustomerStatus,
  c.CreditRating,
  c.BillingProfile,
  c.PrimaryContact,
  c.Mrr,
  p.AccountManager,
  p.Segment,
  p.SupportTier,
  p.Notes
FROM billing.Customers c
LEFT JOIN billing.CustomerProfiles p ON p.CustomerNumber = c.CustomerNumber AND p.IsDeleted = 0
WHERE c.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW billing.vCustomerPricingProfile AS
SELECT
  c.CustomerNumber,
  c.CustomerName,
  c.CustomerType,
  c.Industry,
  c.Region,
  c.CountryCode,
  c.Status,
  c.Mrr,
  rp.PlanName,
  rp.PlanTier,
  rp.MonthlyBaseFee,
  rp.OveragePricePerUnit,
  rp.MinimumCommitment
FROM billing.Customers c
LEFT JOIN billing.RatePlans rp ON rp.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW billing.vProductBillingHierarchy AS
SELECT
  p.ProductId,
  p.ProductCode,
  p.ProductName,
  p.Category,
  p.ServiceCategory,
  p.BillingCode,
  ph.ParentProductId,
  ph.HierarchyPath,
  ph.DisplayOrder
FROM billing.Products p
LEFT JOIN billing.ProductHierarchy ph ON ph.ProductId = p.ProductId;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
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

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vContractDetail AS
SELECT
  c.*,
  o.OpportunityName,
  q.QuoteNumber,
  a.AccountName,
  ISNULL(f.FileCount, 0) AS FileCount
FROM ms.Contracts c
LEFT JOIN ms.Opportunities o ON o.OpportunityId = c.OpportunityId AND o.IsDeleted = 0
LEFT JOIN ms.Quotes q ON q.QuoteId = c.QuoteId AND q.IsDeleted = 0
LEFT JOIN ms.Accounts a ON a.AccountId = o.AccountId AND a.IsDeleted = 0
OUTER APPLY (
  SELECT COUNT(*) AS FileCount
  FROM ms.ContractFiles cf
  WHERE cf.ContractId = c.ContractId AND cf.IsDeleted = 0
) f
WHERE c.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vCustomerLookup AS
SELECT
  c.CustomerNumber,
  c.CustomerName,
  c.CustomerType,
  c.Industry AS IndustryType,
  c.Region AS CustomerRegion,
  c.CountryCode,
  c.Status AS CustomerStatus,
  c.CreditRating
FROM billing.Customers c
WHERE c.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vLeadDetail AS
SELECT
  l.LeadId,
  l.LeadNumber,
  l.CustomerNumber,
  l.AccountName,
  l.ContactName,
  l.Source,
  l.Qualification,
  l.Status,
  l.EstimatedValue,
  l.OwnerName,
  l.ProductInterest,
  l.ServiceNeedsJson,
  l.CustomerInfoJson,
  l.Notes,
  l.ConvertedOpportunityId,
  l.CreatedAtUtc,
  l.UpdatedAtUtc,
  ISNULL(a.ActivityCount, 0) AS ActivityCount,
  c.CustomerName,
  c.CustomerType,
  c.Industry,
  c.Region,
  c.BillingProfile
FROM ms.Leads l
LEFT JOIN billing.Customers c ON c.CustomerNumber = l.CustomerNumber AND c.IsDeleted = 0
OUTER APPLY (
  SELECT COUNT(*) AS ActivityCount
  FROM ms.LeadActivities la
  WHERE la.LeadId = l.LeadId AND la.IsDeleted = 0
) a
WHERE l.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vOpportunityDetail AS
SELECT
  o.*,
  c.AccountName AS AccountNameResolved,
  c.AccountNumber AS AccountNumberResolved,
  c.Segment AS AccountSegment,
  c.Region AS AccountRegion,
  ISNULL(p.ProductCount, 0) AS ProductCount,
  ISNULL(s.ServiceCount, 0) AS ServiceCount,
  ISNULL(n.NoteCount, 0) AS NoteCount,
  ISNULL(q.QuoteCount, 0) AS QuoteCount,
  ISNULL(ap.ApprovalCount, 0) AS ApprovalCount,
  ISNULL(ct.ContractCount, 0) AS ContractCount,
  p.ProductSummary AS ProductSummaryResolved,
  s.ServiceSummary AS ServiceSummaryResolved
FROM ms.Opportunities o
LEFT JOIN ms.Accounts c ON c.AccountId = o.AccountId AND c.IsDeleted = 0
OUTER APPLY (
  SELECT COUNT(*) AS ProductCount,
         STRING_AGG(op.ProductName, ', ') AS ProductSummary
  FROM ms.OpportunityProducts op
  WHERE op.OpportunityId = o.OpportunityId AND op.IsDeleted = 0
) p
OUTER APPLY (
  SELECT COUNT(*) AS ServiceCount,
         STRING_AGG(os.ServiceName, ', ') AS ServiceSummary
  FROM ms.OpportunityServices os
  WHERE os.OpportunityId = o.OpportunityId AND os.IsDeleted = 0
) s
OUTER APPLY (
  SELECT COUNT(*) AS NoteCount
  FROM ms.OpportunityNotes onote
  WHERE onote.OpportunityId = o.OpportunityId AND onote.IsDeleted = 0
) n
OUTER APPLY (
  SELECT COUNT(*) AS QuoteCount
  FROM ms.Quotes q
  WHERE q.OpportunityId = o.OpportunityId AND q.IsDeleted = 0
) q
OUTER APPLY (
  SELECT COUNT(*) AS ApprovalCount
  FROM ms.Approvals a
  WHERE a.EntityType = 'opportunity' AND a.EntityId = o.OpportunityId
) ap
OUTER APPLY (
  SELECT COUNT(*) AS ContractCount
  FROM ms.Contracts c2
  WHERE c2.OpportunityId = o.OpportunityId AND c2.IsDeleted = 0
) ct
WHERE o.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vPricingContext AS
SELECT
  c.CustomerNumber,
  c.CustomerName,
  c.CustomerType,
  c.Industry,
  c.Region,
  c.CountryCode,
  c.Status AS CustomerStatus,
  c.CreditRating,
  CONCAT('SUB-', RIGHT('000000' + CAST(ABS(CHECKSUM(c.CustomerNumber)) % 1000000 AS NVARCHAR(6)), 6)) AS SubscriptionNumber,
  CAST(0 AS DECIMAL(18,2)) AS DiscountPercent,
  CAST(1 AS INT) AS SubscriptionQuantity,
  rp.PlanTier,
  rp.PlanName,
  rp.IncludedUnits,
  rp.OveragePricePerUnit,
  rp.MonthlyBaseFee,
  rp.MinimumCommitment,
  p.ProductCode AS ServiceCode,
  p.ProductName AS ServiceName,
  p.ServiceCategory,
  CAST(0 AS BIT) AS IsUsageBased,
  CAST(1 AS BIT) AS IsRecurring,
  ISNULL(p.BaseMrc, rp.MonthlyBaseFee) AS BaseListPrice,
  CAST(1 AS INT) AS PaidInvoiceCount,
  CAST(1 AS INT) AS TotalInvoiceCount,
  CAST(0 AS INT) AS OverdueInvoiceCount,
  CAST(0 AS INT) AS FailedPaymentCount,
  CAST(1 AS INT) AS TotalPaymentCount,
  CAST(0 AS DECIMAL(18,2)) AS TotalDiscountGiven,
  CAST(0 AS DECIMAL(18,2)) AS TotalInvoiceAmount,
  CAST(0 AS DECIMAL(18,2)) AS RecentUsageVolume30Days,
  CAST(0 AS INT) AS RecentUsageEventCount30Days
FROM billing.Customers c
LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
OUTER APPLY (
  SELECT TOP 1 *
  FROM billing.RatePlans rp
  WHERE rp.IsDeleted = 0
  ORDER BY rp.CreatedAtUtc
) rp
OUTER APPLY (
  SELECT TOP 1 *
  FROM billing.Products p
  WHERE p.IsDeleted = 0
  ORDER BY p.CreatedAtUtc
) p
WHERE c.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vQuoteDetail AS
SELECT
  q.*,
  o.OpportunityName,
  a.AccountName,
  ISNULL(li.LineCount, 0) AS LineItemCount,
  li.LineSummary
FROM ms.Quotes q
LEFT JOIN ms.Opportunities o ON o.OpportunityId = q.OpportunityId AND o.IsDeleted = 0
LEFT JOIN ms.Accounts a ON a.AccountId = o.AccountId AND a.IsDeleted = 0
OUTER APPLY (
  SELECT COUNT(*) AS LineCount,
         STRING_AGG(ql.ProductName, ', ') AS LineSummary
  FROM ms.QuoteLineItems ql
  WHERE ql.QuoteId = q.QuoteId AND ql.IsDeleted = 0
) li
WHERE q.IsDeleted = 0;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW ms.vSalesModuleDashboard AS
SELECT
  (SELECT COUNT(*) FROM ms.Leads WHERE IsDeleted = 0) AS LeadCount,
  (SELECT COUNT(*) FROM ms.Opportunities WHERE IsDeleted = 0) AS OpportunityCount,
  (SELECT COUNT(*) FROM ms.Quotes WHERE IsDeleted = 0) AS QuoteCount,
  (SELECT COUNT(*) FROM ms.Approvals WHERE Status = 'Pending') AS PendingApprovalCount,
  (SELECT COUNT(*) FROM ms.Contracts WHERE IsDeleted = 0) AS ContractCount,
  (SELECT COALESCE(SUM(EstimatedValue), 0) FROM ms.Opportunities WHERE IsDeleted = 0) AS PipelineValue,
  (SELECT COALESCE(SUM(TotalMrc), 0) FROM ms.Quotes WHERE IsDeleted = 0) AS QuoteMrcValue;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
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
