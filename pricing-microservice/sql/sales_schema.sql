IF SCHEMA_ID('ms') IS NULL EXEC('CREATE SCHEMA ms');
IF SCHEMA_ID('billing') IS NULL EXEC('CREATE SCHEMA billing');
GO

IF OBJECT_ID('billing.Customers', 'U') IS NULL
BEGIN
  CREATE TABLE billing.Customers (
    CustomerNumber NVARCHAR(32) NOT NULL PRIMARY KEY,
    CustomerName NVARCHAR(200) NOT NULL,
    CustomerType NVARCHAR(50) NOT NULL,
    Industry NVARCHAR(100) NOT NULL,
    Region NVARCHAR(100) NOT NULL,
    CountryCode NVARCHAR(10) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CreditRating INT NULL,
    BillingProfile NVARCHAR(200) NULL,
    PrimaryContact NVARCHAR(200) NULL,
    Mrr DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0,
    CustomerDataJson NVARCHAR(MAX) NULL
  );
END;
GO

IF OBJECT_ID('billing.CustomerProfiles', 'U') IS NULL
BEGIN
  CREATE TABLE billing.CustomerProfiles (
    CustomerProfileId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    CustomerNumber NVARCHAR(32) NOT NULL,
    AccountManager NVARCHAR(200) NULL,
    Segment NVARCHAR(100) NULL,
    SupportTier NVARCHAR(100) NULL,
    Notes NVARCHAR(MAX) NULL,
    ProfileJson NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.Products', 'U') IS NULL
BEGIN
  CREATE TABLE billing.Products (
    ProductId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ProductCode NVARCHAR(50) NOT NULL,
    ProductName NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100) NOT NULL,
    ServiceCategory NVARCHAR(100) NULL,
    BillingCode NVARCHAR(50) NOT NULL,
    BaseMrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    BaseNrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.Services', 'U') IS NULL
BEGIN
  CREATE TABLE billing.Services (
    ServiceId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ServiceCode NVARCHAR(50) NOT NULL,
    ServiceName NVARCHAR(200) NOT NULL,
    Category NVARCHAR(100) NOT NULL,
    ServiceabilityType NVARCHAR(100) NULL,
    BillingCode NVARCHAR(50) NOT NULL,
    BaseMrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    BaseNrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.ProductHierarchy', 'U') IS NULL
BEGIN
  CREATE TABLE billing.ProductHierarchy (
    ProductHierarchyId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ProductId UNIQUEIDENTIFIER NOT NULL,
    ParentProductId UNIQUEIDENTIFIER NULL,
    HierarchyPath NVARCHAR(400) NOT NULL,
    DisplayOrder INT NOT NULL DEFAULT 0,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('billing.BillingCodes', 'U') IS NULL
BEGIN
  CREATE TABLE billing.BillingCodes (
    BillingCodeId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Code NVARCHAR(50) NOT NULL,
    Description NVARCHAR(200) NOT NULL,
    BillingType NVARCHAR(100) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.BillingElements', 'U') IS NULL
BEGIN
  CREATE TABLE billing.BillingElements (
    BillingElementId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    BillingCodeId UNIQUEIDENTIFIER NOT NULL,
    ElementName NVARCHAR(200) NOT NULL,
    ElementType NVARCHAR(100) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.Offers', 'U') IS NULL
BEGIN
  CREATE TABLE billing.Offers (
    OfferId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OfferCode NVARCHAR(50) NOT NULL,
    OfferName NVARCHAR(200) NOT NULL,
    OfferType NVARCHAR(100) NOT NULL,
    Eligibility NVARCHAR(200) NULL,
    DiscountDescription NVARCHAR(200) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.Promotions', 'U') IS NULL
BEGIN
  CREATE TABLE billing.Promotions (
    PromotionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    PromotionCode NVARCHAR(50) NOT NULL,
    PromotionName NVARCHAR(200) NOT NULL,
    PromotionType NVARCHAR(100) NOT NULL,
    DiscountPct DECIMAL(9,2) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.RatePlans', 'U') IS NULL
BEGIN
  CREATE TABLE billing.RatePlans (
    RatePlanId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ProductId UNIQUEIDENTIFIER NOT NULL,
    PlanCode NVARCHAR(50) NOT NULL,
    PlanName NVARCHAR(200) NOT NULL,
    PlanTier NVARCHAR(100) NOT NULL,
    BillingFrequency NVARCHAR(50) NOT NULL,
    IncludedUnits INT NOT NULL DEFAULT 0,
    OveragePricePerUnit DECIMAL(18,2) NOT NULL DEFAULT 0,
    MonthlyBaseFee DECIMAL(18,2) NOT NULL DEFAULT 0,
    MinimumCommitment DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('billing.ServiceLocations', 'U') IS NULL
BEGIN
  CREATE TABLE billing.ServiceLocations (
    ServiceLocationId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    CustomerNumber NVARCHAR(32) NOT NULL,
    LocationName NVARCHAR(200) NOT NULL,
    AddressLine1 NVARCHAR(200) NOT NULL,
    City NVARCHAR(100) NOT NULL,
    StateProvince NVARCHAR(100) NOT NULL,
    PostalCode NVARCHAR(20) NOT NULL,
    CountryCode NVARCHAR(10) NOT NULL,
    ServiceabilityType NVARCHAR(100) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.Leads', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Leads (
    LeadId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LeadNumber NVARCHAR(32) NOT NULL,
    CustomerNumber NVARCHAR(32) NULL,
    AccountName NVARCHAR(200) NOT NULL,
    ContactName NVARCHAR(200) NULL,
    Source NVARCHAR(100) NULL,
    Qualification NVARCHAR(100) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Open',
    EstimatedValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    OwnerName NVARCHAR(200) NULL,
    ProductInterest NVARCHAR(200) NULL,
    ServiceNeedsJson NVARCHAR(MAX) NULL,
    CustomerInfoJson NVARCHAR(MAX) NULL,
    Notes NVARCHAR(MAX) NULL,
    ConvertedOpportunityId UNIQUEIDENTIFIER NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.LeadActivities', 'U') IS NULL
BEGIN
  CREATE TABLE ms.LeadActivities (
    LeadActivityId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LeadId UNIQUEIDENTIFIER NOT NULL,
    ActivityDate DATETIME2 NOT NULL,
    ActivityType NVARCHAR(50) NOT NULL,
    Outcome NVARCHAR(100) NULL,
    Notes NVARCHAR(MAX) NULL,
    NextStep NVARCHAR(200) NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.Accounts', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Accounts (
    AccountId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    AccountNumber NVARCHAR(32) NOT NULL,
    CustomerNumber NVARCHAR(32) NULL,
    AccountName NVARCHAR(200) NOT NULL,
    Segment NVARCHAR(100) NULL,
    Region NVARCHAR(100) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
    OwnerName NVARCHAR(200) NULL,
    Mrr DECIMAL(18,2) NOT NULL DEFAULT 0,
    CustomerInfoJson NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.Opportunities', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Opportunities (
    OpportunityId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpportunityNumber NVARCHAR(32) NOT NULL,
    LeadId UNIQUEIDENTIFIER NULL,
    AccountId UNIQUEIDENTIFIER NOT NULL,
    OpportunityName NVARCHAR(200) NOT NULL,
    Stage NVARCHAR(100) NOT NULL DEFAULT 'Discovery',
    Status NVARCHAR(30) NOT NULL DEFAULT 'Open',
    OwnerName NVARCHAR(200) NULL,
    CloseDate DATE NULL,
    EstimatedValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    MarginPct DECIMAL(9,2) NULL,
    LocationCount INT NULL,
    ProductSummary NVARCHAR(400) NULL,
    ServiceSummary NVARCHAR(400) NULL,
    ApprovalStatus NVARCHAR(100) NULL,
    ConvertedFromLeadId UNIQUEIDENTIFIER NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.OpportunityProducts', 'U') IS NULL
BEGIN
  CREATE TABLE ms.OpportunityProducts (
    OpportunityProductId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpportunityId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NULL,
    ProductName NVARCHAR(200) NOT NULL,
    BillingCode NVARCHAR(50) NULL,
    Quantity INT NOT NULL DEFAULT 1,
    Mrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Nrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    MarginPct DECIMAL(9,2) NULL,
    ServiceId UNIQUEIDENTIFIER NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.OpportunityServices', 'U') IS NULL
BEGIN
  CREATE TABLE ms.OpportunityServices (
    OpportunityServiceId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpportunityId UNIQUEIDENTIFIER NOT NULL,
    ServiceId UNIQUEIDENTIFIER NULL,
    ServiceName NVARCHAR(200) NOT NULL,
    ServiceDescription NVARCHAR(MAX) NULL,
    LocationCount INT NULL,
    Serviceability NVARCHAR(100) NULL,
    IsPrimary BIT NOT NULL DEFAULT 0,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.OpportunityNotes', 'U') IS NULL
BEGIN
  CREATE TABLE ms.OpportunityNotes (
    OpportunityNoteId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpportunityId UNIQUEIDENTIFIER NOT NULL,
    NoteType NVARCHAR(50) NOT NULL,
    Note NVARCHAR(MAX) NOT NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.Quotes', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Quotes (
    QuoteId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    QuoteNumber NVARCHAR(32) NOT NULL,
    OpportunityId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Draft',
    VersionNo INT NOT NULL DEFAULT 1,
    TotalMrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalNrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    MarginPct DECIMAL(9,2) NULL,
    DiscountPct DECIMAL(9,2) NULL,
    ManualAdjustmentPct DECIMAL(9,2) NULL,
    ApprovalStatus NVARCHAR(100) NULL,
    CustomPricingRequestId UNIQUEIDENTIFIER NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.QuoteLineItems', 'U') IS NULL
BEGIN
  CREATE TABLE ms.QuoteLineItems (
    QuoteLineItemId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    QuoteId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NULL,
    ServiceId UNIQUEIDENTIFIER NULL,
    ProductName NVARCHAR(200) NOT NULL,
    ServiceName NVARCHAR(200) NULL,
    BillingCode NVARCHAR(50) NULL,
    LineType NVARCHAR(50) NOT NULL,
    Quantity INT NOT NULL DEFAULT 1,
    Mrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Nrc DECIMAL(18,2) NOT NULL DEFAULT 0,
    Cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    MarginPct DECIMAL(9,2) NULL,
    DiscountPct DECIMAL(9,2) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.PricingInputs', 'U') IS NULL
BEGIN
  CREATE TABLE ms.PricingInputs (
    PricingInputId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    QuoteId UNIQUEIDENTIFIER NOT NULL,
    InputJson NVARCHAR(MAX) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('ms.PricingResults', 'U') IS NULL
BEGIN
  CREATE TABLE ms.PricingResults (
    PricingResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    QuoteId UNIQUEIDENTIFIER NOT NULL,
    ResultJson NVARCHAR(MAX) NOT NULL,
    RecommendedPrice DECIMAL(18,2) NULL,
    ExpectedMarginPct DECIMAL(9,2) NULL,
    FinalPrice DECIMAL(18,2) NULL,
    Score DECIMAL(9,2) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('ms.Approvals', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Approvals (
    ApprovalId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    EntityType NVARCHAR(50) NOT NULL,
    EntityId UNIQUEIDENTIFIER NOT NULL,
    ApprovalType NVARCHAR(50) NULL,
    StepName NVARCHAR(100) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Pending',
    RequestedBy NVARCHAR(200) NULL,
    ApprovedBy NVARCHAR(200) NULL,
    RejectionReason NVARCHAR(MAX) NULL,
    RequestedChanges NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('ms.Contracts', 'U') IS NULL
BEGIN
  CREATE TABLE ms.Contracts (
    ContractId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ContractNumber NVARCHAR(32) NOT NULL,
    OpportunityId UNIQUEIDENTIFIER NOT NULL,
    QuoteId UNIQUEIDENTIFIER NULL,
    ContractName NVARCHAR(200) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Open',
    TermsJson NVARCHAR(MAX) NULL,
    SignedDate DATE NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.ContractFiles', 'U') IS NULL
BEGIN
  CREATE TABLE ms.ContractFiles (
    ContractFileId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ContractId UNIQUEIDENTIFIER NOT NULL,
    FileName NVARCHAR(200) NOT NULL,
    FileType NVARCHAR(50) NOT NULL,
    StorageUrl NVARCHAR(500) NULL,
    FileSizeBytes BIGINT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.ContractHistory', 'U') IS NULL
BEGIN
  CREATE TABLE ms.ContractHistory (
    ContractHistoryId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ContractId UNIQUEIDENTIFIER NOT NULL,
    EventType NVARCHAR(100) NOT NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedBy NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID('ms.CustomPricingRequests', 'U') IS NULL
BEGIN
  CREATE TABLE ms.CustomPricingRequests (
    CustomPricingRequestId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    QuoteId UNIQUEIDENTIFIER NULL,
    OpportunityId UNIQUEIDENTIFIER NULL,
    RequestNumber NVARCHAR(32) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'Draft',
    Reason NVARCHAR(MAX) NULL,
    RequestedBy NVARCHAR(200) NULL,
    SubmittedAtUtc DATETIME2 NULL,
    ApprovedAtUtc DATETIME2 NULL,
    RejectedAtUtc DATETIME2 NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsDeleted BIT NOT NULL DEFAULT 0
  );
END;
GO

IF OBJECT_ID('ms.ServiceabilityChecks', 'U') IS NULL
BEGIN
  CREATE TABLE ms.ServiceabilityChecks (
    ServiceabilityCheckId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LeadId UNIQUEIDENTIFIER NULL,
    OpportunityId UNIQUEIDENTIFIER NULL,
    CustomerNumber NVARCHAR(32) NULL,
    LocationName NVARCHAR(200) NOT NULL,
    AddressLine1 NVARCHAR(200) NULL,
    City NVARCHAR(100) NULL,
    StateProvince NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    ResultStatus NVARCHAR(30) NOT NULL,
    ResultJson NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
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
