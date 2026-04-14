-- ============================================================================
-- Azure SQL Schema Migration for Customer-Aware Billing-Based Pricing
-- ============================================================================
--
-- PURPOSE:
--   Enable the pricing microservice to lookup customer profiles from the
--   billing schema and make pricing decisions based on real customer context,
--   payment behavior, and usage patterns.
--
-- FLOW:
--   1. User enters Customer Number (e.g., "CUST-12345")
--   2. API extracts numeric portion (e.g., 12345)
--   3. Queries ms.vCustomerLookup view in Azure SQL
--   4. Returns customer profile fields to Web UI for auto-fill
--   5. Pricing algorithm queries ms.vPricingContext view
--   6. Pricing algorithm considers customer risk, service value, profitability
--   7. Result is explainable, consistent pricing tied to actual billing relationship
--
-- VIEWS CREATED:
--   ms.vCustomerLookup        - Returns customer profile for Web UI auto-fill
--   ms.vPricingContext        - Returns enriched billing context for pricing algorithm
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Create customer lookup view in ms schema
-- ============================================================================
-- This view supports the Web UI auto-fill behavior when a customer number is entered.
-- It returns the specific fields needed: Customer Type, Industry, Region, Country, Status, Credit Rating.
-- The lookup uses numeric-only matching for flexibility.

DROP VIEW IF EXISTS ms.vCustomerLookup;

CREATE VIEW ms.vCustomerLookup AS
SELECT
    c.CustomerId,
    c.CustomerNumber,
    c.CustomerName,
    c.CustomerType,           -- REQUIRED: Auto-fill in Web UI
    c.Industry AS IndustryType, -- REQUIRED: Auto-fill in Web UI
    c.Region AS CustomerRegion, -- REQUIRED: Auto-fill in Web UI
    c.CountryCode,            -- REQUIRED: Auto-fill in Web UI
    c.Status AS CustomerStatus, -- REQUIRED: Auto-fill in Web UI
    c.CreditRating,           -- REQUIRED: Auto-fill in Web UI
    -- Latest subscription context
    MAX(s.SubscriptionId) AS LatestSubscriptionId
FROM billing.Customers AS c
LEFT JOIN billing.Subscriptions AS s
    ON s.CustomerId = c.CustomerId
    AND s.Status = 'Active'
GROUP BY
    c.CustomerId, c.CustomerNumber, c.CustomerName, c.CustomerType,
    c.Industry, c.Region, c.CountryCode, c.Status, c.CreditRating;

DROP VIEW IF EXISTS ms.vCustomerLookupOptions;

CREATE VIEW ms.vCustomerLookupOptions AS
SELECT DISTINCT
    CustomerRegion,
    CountryCode,
    CustomerStatus
FROM ms.vCustomerLookup;

-- ============================================================================
-- STEP 2: Create comprehensive pricing context view in ms schema
-- ============================================================================
-- This view aggregates all billing data needed by the pricing algorithm:
-- - Customer attributes
-- - Subscription & plan structure
-- - Service details
-- - Discount history
-- - Payment reliability signals
-- - Invoice health
-- - Recent usage volume
-- 
-- The algorithm uses these signals to adjust the final price to reflect:
-- - Customer risk (credit rating, payment history, status)
-- - Market fit (customer type, industry, region)
-- - Service value (plan tier, included units, overage structure)
-- - Profitability factors (discount history, payment reliability, usage intensity)

DROP VIEW IF EXISTS ms.vPricingContext;

CREATE VIEW ms.vPricingContext AS
SELECT
    c.CustomerId,
    c.CustomerNumber,
    c.CustomerName,
    c.CustomerType,
    c.Industry,
    c.Region,
    c.CountryCode,
    c.Status AS CustomerStatus,
    c.CreditRating,
    
    -- Subscription context
    s.SubscriptionNumber,
    s.DiscountPercent,
    s.Quantity AS SubscriptionQuantity,
    
    -- Plan context
    rp.PlanTier,
    rp.PlanName,
    rp.IncludedUnits,
    rp.OveragePricePerUnit,
    rp.MonthlyBaseFee,
    rp.MinimumCommitment,
    
    -- Service context
    srv.ServiceCode,
    srv.ServiceName,
    srv.ServiceCategory,
    srv.IsUsageBased,
    srv.IsRecurring,
    srv.BaseListPrice,
    
    -- Billing history aggregates
    COALESCE((
        SELECT COUNT(*)
        FROM billing.Invoices
        WHERE CustomerId = c.CustomerId AND InvoiceStatus IN ('Paid', 'Settled')
    ), 0) AS PaidInvoiceCount,
    
    COALESCE((
        SELECT COUNT(*)
        FROM billing.Invoices
        WHERE CustomerId = c.CustomerId
    ), 0) AS TotalInvoiceCount,
    
    COALESCE((
        SELECT COUNT(*)
        FROM billing.Invoices
        WHERE CustomerId = c.CustomerId AND InvoiceStatus IN ('Overdue', 'Partial')
    ), 0) AS OverdueInvoiceCount,
    
    -- Payment reliability
    COALESCE((
        SELECT COUNT(*)
        FROM billing.Payments
        WHERE CustomerId = c.CustomerId AND PaymentStatus IN ('Failed', 'Reversed')
    ), 0) AS FailedPaymentCount,
    
    COALESCE((
        SELECT COUNT(*)
        FROM billing.Payments
        WHERE CustomerId = c.CustomerId
    ), 0) AS TotalPaymentCount,
    
    -- Discount aggregates
    COALESCE((
        SELECT SUM(DiscountAmount)
        FROM billing.Invoices
        WHERE CustomerId = c.CustomerId
    ), 0) AS TotalDiscountGiven,
    
    COALESCE((
        SELECT SUM(TotalAmount)
        FROM billing.Invoices
        WHERE CustomerId = c.CustomerId
    ), 0) AS TotalInvoiceAmount,
    
    -- Recent usage (last 30 days)
    COALESCE((
        SELECT SUM(UsageQuantity)
        FROM billing.UsageEvents
        WHERE CustomerId = c.CustomerId
        AND EventTimestamp >= DATEADD(DAY, -30, GETUTCDATE())
    ), 0) AS RecentUsageVolume30Days,
    
    COALESCE((
        SELECT COUNT(*)
        FROM billing.UsageEvents
        WHERE CustomerId = c.CustomerId
        AND EventTimestamp >= DATEADD(DAY, -30, GETUTCDATE())
    ), 0) AS RecentUsageEventCount30Days
    
FROM billing.Customers AS c
LEFT JOIN billing.Subscriptions AS s
    ON s.CustomerId = c.CustomerId
    AND s.Status = 'Active'
LEFT JOIN billing.RatePlans AS rp
    ON rp.RatePlanId = s.RatePlanId
LEFT JOIN billing.Services AS srv
    ON srv.ServiceId = s.ServiceId;

-- ============================================================================
-- STEP 3: Add optional metadata columns to ms.Opportunity table
-- ============================================================================
-- These columns store the customer/billing context used for pricing,
-- providing traceability and audit trail for pricing decisions.

DROP TABLE IF EXISTS ms.OpportunityTemp;

CREATE TABLE ms.OpportunityTemp AS
SELECT * FROM ms.Opportunity WHERE 1=0;

ALTER TABLE ms.OpportunityTemp ADD
    -- Customer profile at time of quote
    CustomerType nvarchar(100) NULL,
    IndustryType nvarchar(100) NULL,
    CustomerRegion nvarchar(100) NULL,
    CountryCode nvarchar(10) NULL,
    CustomerStatus nvarchar(50) NULL,
    CreditRating int NULL,
    
    -- Service/Plan context
    PlanTier nvarchar(100) NULL,
    PlanName nvarchar(200) NULL,
    ServiceName nvarchar(200) NULL,
    ServiceCategory nvarchar(100) NULL,
    SubscriptionQuantity int NULL,
    
    -- Billing signals at time of quote
    AverageDiscountPct decimal(8,4) NULL,
    InvoiceHealthScore decimal(8,4) NULL,
    PaymentReliabilityScore decimal(8,4) NULL,
    RecentUsageVolume decimal(20,4) NULL;

-- If ms.Opportunity table already has some of these columns, skip this step
-- and proceed with ALTER TABLE approach if needed.

-- ============================================================================
-- STEP 4: Add optional metadata columns to ms.QuoteHistory table
-- ============================================================================
-- Same as Opportunity, provides traceability for each quote version.

ALTER TABLE ms.QuoteHistory ADD
    -- Customer profile at time of quote version
    CustomerType nvarchar(100) NULL,
    IndustryType nvarchar(100) NULL,
    CustomerRegion nvarchar(100) NULL,
    CountryCode nvarchar(10) NULL,
    CustomerStatus nvarchar(50) NULL,
    CreditRating int NULL,
    
    -- Service/Plan context
    PlanTier nvarchar(100) NULL,
    PlanName nvarchar(200) NULL,
    ServiceName nvarchar(200) NULL,
    ServiceCategory nvarchar(100) NULL,
    SubscriptionQuantity int NULL,
    
    -- Billing signals at time of quote
    AverageDiscountPct decimal(8,4) NULL,
    InvoiceHealthScore decimal(8,4) NULL,
    PaymentReliabilityScore decimal(8,4) NULL,
    RecentUsageVolume decimal(20,4) NULL;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After running this migration:
--
-- 1. Web UI can call the API which queries ms.vCustomerLookup view
-- 2. Web UI receives: CustomerType, IndustryType, CustomerRegion, CountryCode, CustomerStatus, CreditRating
-- 3. Web UI auto-fills those fields
-- 4. Pricing algorithm queries ms.vPricingContext view
-- 5. Algorithm considers all billing context to make pricing decisions
-- 6. Result is pricing based on real customer relationships, not generic inputs
--
-- The billing schema remains read-only source of truth.
-- The ms schema contains only views (no write-back to billing).
-- ============================================================================
