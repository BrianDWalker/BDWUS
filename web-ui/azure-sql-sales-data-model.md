# Azure SQL Sales Data Model

This document summarizes the Azure SQL schema used by the Sales Module, the billing/reference data, the main views, and how the web UI and backend APIs connect to them.

Source of truth:
- Backend schema: [`pricing-microservice/sql/sales_schema.sql`](/Users/brianwalker/Documents/BDWUS%20Project/pricing-microservice/sql/sales_schema.sql)
- Sales API layer: [`pricing-microservice/app/services/sales.py`](/Users/brianwalker/Documents/BDWUS%20Project/pricing-microservice/app/services/sales.py)
- Sales UI: [`web-ui/src/components/SalesDatabaseCRM.jsx`](/Users/brianwalker/Documents/BDWUS%20Project/web-ui/src/components/SalesDatabaseCRM.jsx)
- Route wiring: [`web-ui/src/SalesAppRouter.jsx`](/Users/brianwalker/Documents/BDWUS%20Project/web-ui/src/SalesAppRouter.jsx)

## How The Layers Connect

Frontend:
- The Sales UI never queries SQL directly.
- The UI calls REST APIs in [`web-ui/src/utils/salesApi.js`](/Users/brianwalker/Documents/BDWUS%20Project/web-ui/src/utils/salesApi.js).

Backend:
- The FastAPI service exposes `/api/sales/*` and `/api/billing/*`.
- Those endpoints read and write Azure SQL tables and views.

Sales landing load path:
- `GET /api/sales/bootstrap` returns the initial dashboard payload, records, and reference data in one response.

Main UI routes:
- `#sales` -> Sales landing page
- `#details/lead/{id}` -> lead detail page
- `#details/opportunity/{id}` -> opportunity detail page
- `#details/quote/{id}` -> quote detail page
- `#details/contract/{id}` -> contract detail page

## Logical Relationships

The schema uses soft delete and timestamp fields instead of heavy hard deletes in most workflow tables.

Primary flow:
1. `ms.Leads`
2. `ms.LeadActivities`
3. `ms.Accounts`
4. `ms.Opportunities`
5. `ms.OpportunityProducts`
6. `ms.OpportunityServices`
7. `ms.OpportunityNotes`
8. `ms.Quotes`
9. `ms.QuoteLineItems`
10. `ms.PricingInputs`
11. `ms.PricingResults`
12. `ms.Approvals`
13. `ms.Contracts`
14. `ms.ContractFiles`
15. `ms.ContractHistory`

Reference data flow:
- `billing.Customers`
- `billing.CustomerProfiles`
- `billing.Products`
- `billing.Services`
- `billing.ProductHierarchy`
- `billing.BillingCodes`
- `billing.BillingElements`
- `billing.Offers`
- `billing.Promotions`
- `billing.RatePlans`
- `billing.ServiceLocations`

## `ms` Schema Tables

### `ms.Leads`
Primary key:
- `LeadId`

Columns:
- `LeadId` `UNIQUEIDENTIFIER` PK
- `LeadNumber` `NVARCHAR(32)`
- `CustomerNumber` `NVARCHAR(32)` nullable, logical link to `billing.Customers.CustomerNumber`
- `AccountName` `NVARCHAR(200)`
- `ContactName` `NVARCHAR(200)` nullable
- `Source` `NVARCHAR(100)` nullable
- `Qualification` `NVARCHAR(100)` nullable
- `Status` `NVARCHAR(30)` default `Open`
- `EstimatedValue` `DECIMAL(18,2)` default `0`
- `OwnerName` `NVARCHAR(200)` nullable
- `ProductInterest` `NVARCHAR(200)` nullable
- `ServiceNeedsJson` `NVARCHAR(MAX)` nullable
- `CustomerInfoJson` `NVARCHAR(MAX)` nullable
- `Notes` `NVARCHAR(MAX)` nullable
- `ConvertedOpportunityId` `UNIQUEIDENTIFIER` nullable, logical link to `ms.Opportunities.OpportunityId`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/leads`
- `GET /api/sales/leads/{id}`
- `POST /api/sales/leads`
- `PUT /api/sales/leads/{id}`
- `DELETE /api/sales/leads/{id}`
- `POST /api/sales/leads/{id}/convert`

UI:
- Sales -> Leads tab
- Lead detail page

### `ms.LeadActivities`
Primary key:
- `LeadActivityId`

Columns:
- `LeadActivityId` `UNIQUEIDENTIFIER` PK
- `LeadId` `UNIQUEIDENTIFIER` logical FK to `ms.Leads.LeadId`
- `ActivityDate` `DATETIME2`
- `ActivityType` `NVARCHAR(50)`
- `Outcome` `NVARCHAR(100)` nullable
- `Notes` `NVARCHAR(MAX)` nullable
- `NextStep` `NVARCHAR(200)` nullable
- `CreatedBy` `NVARCHAR(200)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/leads/{id}/activities`
- `POST /api/sales/leads/{id}/activities`

UI:
- Lead detail -> Activity tab

### `ms.Accounts`
Primary key:
- `AccountId`

Columns:
- `AccountId` `UNIQUEIDENTIFIER` PK
- `AccountNumber` `NVARCHAR(32)`
- `CustomerNumber` `NVARCHAR(32)` nullable, logical link to billing customer
- `AccountName` `NVARCHAR(200)`
- `Segment` `NVARCHAR(100)` nullable
- `Region` `NVARCHAR(100)` nullable
- `Status` `NVARCHAR(30)` default `Active`
- `OwnerName` `NVARCHAR(200)` nullable
- `Mrr` `DECIMAL(18,2)` default `0`
- `CustomerInfoJson` `NVARCHAR(MAX)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/accounts`
- `GET /api/sales/accounts/{id}`
- `POST /api/sales/accounts`
- `PUT /api/sales/accounts/{id}`
- `DELETE /api/sales/accounts/{id}`

UI:
- Sales -> Accounts tab
- Account rows can open Customer 360 and New Opportunity workflows

### `ms.Opportunities`
Primary key:
- `OpportunityId`

Columns:
- `OpportunityId` `UNIQUEIDENTIFIER` PK
- `OpportunityNumber` `NVARCHAR(32)`
- `LeadId` `UNIQUEIDENTIFIER` nullable, logical link to `ms.Leads.LeadId`
- `AccountId` `UNIQUEIDENTIFIER` logical FK to `ms.Accounts.AccountId`
- `OpportunityName` `NVARCHAR(200)`
- `Stage` `NVARCHAR(100)` default `Discovery`
- `Status` `NVARCHAR(30)` default `Open`
- `OwnerName` `NVARCHAR(200)` nullable
- `CloseDate` `DATE` nullable
- `EstimatedValue` `DECIMAL(18,2)` default `0`
- `MarginPct` `DECIMAL(9,2)` nullable
- `LocationCount` `INT` nullable
- `ProductSummary` `NVARCHAR(400)` nullable
- `ServiceSummary` `NVARCHAR(400)` nullable
- `ApprovalStatus` `NVARCHAR(100)` nullable
- `ConvertedFromLeadId` `UNIQUEIDENTIFIER` nullable, logical link to `ms.Leads.LeadId`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/opportunities`
- `GET /api/sales/opportunities/{id}`
- `POST /api/sales/opportunities`
- `PUT /api/sales/opportunities/{id}`
- `DELETE /api/sales/opportunities/{id}`

UI:
- Sales -> Opportunities tab
- Opportunity detail page

### `ms.OpportunityProducts`
Primary key:
- `OpportunityProductId`

Columns:
- `OpportunityProductId` `UNIQUEIDENTIFIER` PK
- `OpportunityId` `UNIQUEIDENTIFIER` logical FK to `ms.Opportunities.OpportunityId`
- `ProductId` `UNIQUEIDENTIFIER` nullable, logical FK to `billing.Products.ProductId`
- `ProductName` `NVARCHAR(200)`
- `BillingCode` `NVARCHAR(50)` nullable
- `Quantity` `INT` default `1`
- `Mrc` `DECIMAL(18,2)` default `0`
- `Nrc` `DECIMAL(18,2)` default `0`
- `Cost` `DECIMAL(18,2)` default `0`
- `MarginPct` `DECIMAL(9,2)` nullable
- `ServiceId` `UNIQUEIDENTIFIER` nullable, logical FK to `billing.Services.ServiceId`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/opportunities/{id}/products`
- `POST /api/sales/opportunities/{id}/products`
- `PUT /api/sales/opportunities/{id}/products/{productId}`
- `DELETE /api/sales/opportunities/{id}/products/{productId}`

UI:
- Opportunity detail -> Products/Services tab
- Quote generation uses this table as the source of line items

### `ms.OpportunityServices`
Primary key:
- `OpportunityServiceId`

Columns:
- `OpportunityServiceId` `UNIQUEIDENTIFIER` PK
- `OpportunityId` `UNIQUEIDENTIFIER` logical FK to `ms.Opportunities.OpportunityId`
- `ServiceId` `UNIQUEIDENTIFIER` nullable, logical FK to `billing.Services.ServiceId`
- `ServiceName` `NVARCHAR(200)`
- `ServiceDescription` `NVARCHAR(MAX)` nullable
- `LocationCount` `INT` nullable
- `Serviceability` `NVARCHAR(100)` nullable
- `IsPrimary` `BIT` default `0`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- Opportunity service workflows
- Future service catalog expansion

### `ms.OpportunityNotes`
Primary key:
- `OpportunityNoteId`

Columns:
- `OpportunityNoteId` `UNIQUEIDENTIFIER` PK
- `OpportunityId` `UNIQUEIDENTIFIER` logical FK to `ms.Opportunities.OpportunityId`
- `NoteType` `NVARCHAR(50)`
- `Note` `NVARCHAR(MAX)`
- `CreatedBy` `NVARCHAR(200)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/opportunities/{id}/notes`
- `POST /api/sales/opportunities/{id}/notes`

UI:
- Opportunity detail -> Activity/Notes tab

### `ms.Quotes`
Primary key:
- `QuoteId`

Columns:
- `QuoteId` `UNIQUEIDENTIFIER` PK
- `QuoteNumber` `NVARCHAR(32)`
- `OpportunityId` `UNIQUEIDENTIFIER` logical FK to `ms.Opportunities.OpportunityId`
- `Status` `NVARCHAR(30)` default `Draft`
- `VersionNo` `INT` default `1`
- `TotalMrc` `DECIMAL(18,2)` default `0`
- `TotalNrc` `DECIMAL(18,2)` default `0`
- `MarginPct` `DECIMAL(9,2)` nullable
- `DiscountPct` `DECIMAL(9,2)` nullable
- `ManualAdjustmentPct` `DECIMAL(9,2)` nullable
- `ApprovalStatus` `NVARCHAR(100)` nullable
- `CustomPricingRequestId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.CustomPricingRequests.CustomPricingRequestId`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/quotes`
- `GET /api/sales/quotes/{id}`
- `POST /api/sales/quotes`
- `PUT /api/sales/quotes/{id}`
- `DELETE /api/sales/quotes/{id}`
- `POST /api/sales/quotes/{id}/price`
- `POST /api/sales/quotes/{id}/submit-approval`

UI:
- Sales -> Custom Pricing / Quotes workflows
- Quote detail page

### `ms.QuoteLineItems`
Primary key:
- `QuoteLineItemId`

Columns:
- `QuoteLineItemId` `UNIQUEIDENTIFIER` PK
- `QuoteId` `UNIQUEIDENTIFIER` logical FK to `ms.Quotes.QuoteId`
- `ProductId` `UNIQUEIDENTIFIER` nullable, logical FK to `billing.Products.ProductId`
- `ServiceId` `UNIQUEIDENTIFIER` nullable, logical FK to `billing.Services.ServiceId`
- `ProductName` `NVARCHAR(200)`
- `ServiceName` `NVARCHAR(200)` nullable
- `BillingCode` `NVARCHAR(50)` nullable
- `LineType` `NVARCHAR(50)`
- `Quantity` `INT` default `1`
- `Mrc` `DECIMAL(18,2)` default `0`
- `Nrc` `DECIMAL(18,2)` default `0`
- `Cost` `DECIMAL(18,2)` default `0`
- `MarginPct` `DECIMAL(9,2)` nullable
- `DiscountPct` `DECIMAL(9,2)` nullable
- `Notes` `NVARCHAR(MAX)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/quotes/{id}/line-items`
- `POST /api/sales/quotes/{id}/line-items`
- `PUT /api/sales/quotes/{id}/line-items/{lineItemId}`
- `DELETE /api/sales/quotes/{id}/line-items/{lineItemId}`

UI:
- Quote detail -> Line Items tab
- Quote pricing workflow

### `ms.PricingInputs`
Primary key:
- `PricingInputId`

Columns:
- `PricingInputId` `UNIQUEIDENTIFIER` PK
- `QuoteId` `UNIQUEIDENTIFIER` logical FK to `ms.Quotes.QuoteId`
- `InputJson` `NVARCHAR(MAX)` not null
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`

Used by:
- Quote pricing requests

### `ms.PricingResults`
Primary key:
- `PricingResultId`

Columns:
- `PricingResultId` `UNIQUEIDENTIFIER` PK
- `QuoteId` `UNIQUEIDENTIFIER` logical FK to `ms.Quotes.QuoteId`
- `ResultJson` `NVARCHAR(MAX)` not null
- `RecommendedPrice` `DECIMAL(18,2)` nullable
- `ExpectedMarginPct` `DECIMAL(9,2)` nullable
- `FinalPrice` `DECIMAL(18,2)` nullable
- `Score` `DECIMAL(9,2)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`

Used by:
- `POST /api/sales/quotes/{id}/price`

UI:
- Quote detail -> Pricing tab

### `ms.Approvals`
Primary key:
- `ApprovalId`

Columns:
- `ApprovalId` `UNIQUEIDENTIFIER` PK
- `EntityType` `NVARCHAR(50)`
- `EntityId` `UNIQUEIDENTIFIER`
- `ApprovalType` `NVARCHAR(50)` nullable
- `StepName` `NVARCHAR(100)` nullable
- `Status` `NVARCHAR(30)` default `Pending`
- `RequestedBy` `NVARCHAR(200)` nullable
- `ApprovedBy` `NVARCHAR(200)` nullable
- `RejectionReason` `NVARCHAR(MAX)` nullable
- `RequestedChanges` `NVARCHAR(MAX)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`

Used by:
- `GET /api/sales/approvals`
- `GET /api/sales/approvals/{id}`
- `POST /api/sales/approvals/{id}/approve`
- `POST /api/sales/approvals/{id}/reject`
- `POST /api/sales/approvals/{id}/request-changes`

UI:
- Sales -> Approvals tab
- Quote approval workflow

### `ms.Contracts`
Primary key:
- `ContractId`

Columns:
- `ContractId` `UNIQUEIDENTIFIER` PK
- `ContractNumber` `NVARCHAR(32)`
- `OpportunityId` `UNIQUEIDENTIFIER` logical FK to `ms.Opportunities.OpportunityId`
- `QuoteId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.Quotes.QuoteId`
- `ContractName` `NVARCHAR(200)`
- `Status` `NVARCHAR(30)` default `Open`
- `TermsJson` `NVARCHAR(MAX)` nullable
- `SignedDate` `DATE` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/contracts`
- `GET /api/sales/contracts/{id}`
- `POST /api/sales/contracts`
- `PUT /api/sales/contracts/{id}`
- `DELETE /api/sales/contracts/{id}`

UI:
- Sales -> Contracts tab
- Contract detail page

### `ms.ContractFiles`
Primary key:
- `ContractFileId`

Columns:
- `ContractFileId` `UNIQUEIDENTIFIER` PK
- `ContractId` `UNIQUEIDENTIFIER` logical FK to `ms.Contracts.ContractId`
- `FileName` `NVARCHAR(200)`
- `FileType` `NVARCHAR(50)`
- `StorageUrl` `NVARCHAR(500)` nullable
- `FileSizeBytes` `BIGINT` nullable
- `CreatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/contracts/{id}/files`
- `POST /api/sales/contracts/{id}/files`
- `DELETE /api/sales/contracts/{id}/files/{fileId}`

UI:
- Contract detail -> Files tab

### `ms.ContractHistory`
Primary key:
- `ContractHistoryId`

Columns:
- `ContractHistoryId` `UNIQUEIDENTIFIER` PK
- `ContractId` `UNIQUEIDENTIFIER` logical FK to `ms.Contracts.ContractId`
- `EventType` `NVARCHAR(100)`
- `Notes` `NVARCHAR(MAX)` nullable
- `CreatedBy` `NVARCHAR(200)` nullable
- `CreatedAtUtc` `DATETIME2`

Used by:
- `GET /api/sales/contracts/{id}/history`
- contract file uploads and approval-generated events

UI:
- Contract detail -> History tab

### `ms.CustomPricingRequests`
Primary key:
- `CustomPricingRequestId`

Columns:
- `CustomPricingRequestId` `UNIQUEIDENTIFIER` PK
- `QuoteId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.Quotes.QuoteId`
- `OpportunityId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.Opportunities.OpportunityId`
- `RequestNumber` `NVARCHAR(32)`
- `Status` `NVARCHAR(30)` default `Draft`
- `Reason` `NVARCHAR(MAX)` nullable
- `RequestedBy` `NVARCHAR(200)` nullable
- `SubmittedAtUtc` `DATETIME2` nullable
- `ApprovedAtUtc` `DATETIME2` nullable
- `RejectedAtUtc` `DATETIME2` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/sales/custom-pricing`
- `GET /api/sales/custom-pricing/{id}`
- `POST /api/sales/custom-pricing`
- `PUT /api/sales/custom-pricing/{id}`
- `DELETE /api/sales/custom-pricing/{id}`
- `POST /api/sales/custom-pricing/{id}/submit`

UI:
- Sales -> Custom Pricing tab

### `ms.ServiceabilityChecks`
Primary key:
- `ServiceabilityCheckId`

Columns:
- `ServiceabilityCheckId` `UNIQUEIDENTIFIER` PK
- `LeadId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.Leads.LeadId`
- `OpportunityId` `UNIQUEIDENTIFIER` nullable, logical FK to `ms.Opportunities.OpportunityId`
- `CustomerNumber` `NVARCHAR(32)` nullable
- `LocationName` `NVARCHAR(200)`
- `AddressLine1` `NVARCHAR(200)` nullable
- `City` `NVARCHAR(100)` nullable
- `StateProvince` `NVARCHAR(100)` nullable
- `PostalCode` `NVARCHAR(20)` nullable
- `ResultStatus` `NVARCHAR(30)`
- `ResultJson` `NVARCHAR(MAX)` nullable
- `CreatedAtUtc` `DATETIME2`

Used by:
- `POST /api/sales/serviceability/check`

UI:
- Opportunity detail -> Run Address Check

## `billing` Schema Tables

### `billing.Customers`
Primary key:
- `CustomerNumber`

Columns:
- `CustomerNumber` `NVARCHAR(32)` PK
- `CustomerName` `NVARCHAR(200)`
- `CustomerType` `NVARCHAR(50)`
- `Industry` `NVARCHAR(100)`
- `Region` `NVARCHAR(100)`
- `CountryCode` `NVARCHAR(10)`
- `Status` `NVARCHAR(30)`
- `CreditRating` `INT` nullable
- `BillingProfile` `NVARCHAR(200)` nullable
- `PrimaryContact` `NVARCHAR(200)` nullable
- `Mrr` `DECIMAL(18,2)` default `0`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`
- `CustomerDataJson` `NVARCHAR(MAX)` nullable

Used by:
- `GET /api/billing/customers`
- `GET /api/billing/customers/{customerNumber}`
- `GET /api/billing/customer-lookup/{customerNumber}`

UI:
- Sales landing bootstrap
- Accounts / Customer 360 / lead conversion

### `billing.CustomerProfiles`
Primary key:
- `CustomerProfileId`

Columns:
- `CustomerProfileId` `UNIQUEIDENTIFIER` PK
- `CustomerNumber` `NVARCHAR(32)` logical FK to `billing.Customers.CustomerNumber`
- `AccountManager` `NVARCHAR(200)` nullable
- `Segment` `NVARCHAR(100)` nullable
- `SupportTier` `NVARCHAR(100)` nullable
- `Notes` `NVARCHAR(MAX)` nullable
- `ProfileJson` `NVARCHAR(MAX)` nullable
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

### `billing.Products`
Primary key:
- `ProductId`

Columns:
- `ProductId` `UNIQUEIDENTIFIER` PK
- `ProductCode` `NVARCHAR(50)`
- `ProductName` `NVARCHAR(200)`
- `Category` `NVARCHAR(100)`
- `ServiceCategory` `NVARCHAR(100)` nullable
- `BillingCode` `NVARCHAR(50)`
- `BaseMrc` `DECIMAL(18,2)` default `0`
- `BaseNrc` `DECIMAL(18,2)` default `0`
- `Status` `NVARCHAR(30)` default `Active`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/products`
- `GET /api/billing/products/{id}`

UI:
- Opportunity pricing
- Quote line item selection

### `billing.Services`
Primary key:
- `ServiceId`

Columns:
- `ServiceId` `UNIQUEIDENTIFIER` PK
- `ServiceCode` `NVARCHAR(50)`
- `ServiceName` `NVARCHAR(200)`
- `Category` `NVARCHAR(100)`
- `ServiceabilityType` `NVARCHAR(100)` nullable
- `BillingCode` `NVARCHAR(50)`
- `BaseMrc` `DECIMAL(18,2)` default `0`
- `BaseNrc` `DECIMAL(18,2)` default `0`
- `Status` `NVARCHAR(30)` default `Active`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

### `billing.ProductHierarchy`
Primary key:
- `ProductHierarchyId`

Columns:
- `ProductHierarchyId` `UNIQUEIDENTIFIER` PK
- `ProductId` `UNIQUEIDENTIFIER` logical FK to `billing.Products.ProductId`
- `ParentProductId` `UNIQUEIDENTIFIER` nullable, self-reference to `billing.Products.ProductId`
- `HierarchyPath` `NVARCHAR(400)`
- `DisplayOrder` `INT` default `0`
- `CreatedAtUtc` `DATETIME2`

Used by:
- `GET /api/billing/product-hierarchy`

UI:
- Opportunity pricing -> product hierarchy display

### `billing.BillingCodes`
Primary key:
- `BillingCodeId`

Columns:
- `BillingCodeId` `UNIQUEIDENTIFIER` PK
- `Code` `NVARCHAR(50)`
- `Description` `NVARCHAR(200)`
- `BillingType` `NVARCHAR(100)`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/billing-codes`

UI:
- Opportunity and quote pricing forms

### `billing.BillingElements`
Primary key:
- `BillingElementId`

Columns:
- `BillingElementId` `UNIQUEIDENTIFIER` PK
- `BillingCodeId` `UNIQUEIDENTIFIER` logical FK to `billing.BillingCodes.BillingCodeId`
- `ElementName` `NVARCHAR(200)`
- `ElementType` `NVARCHAR(100)`
- `Amount` `DECIMAL(18,2)` default `0`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/billing-elements`

UI:
- Opportunity pricing -> billing element breakdown

### `billing.Offers`
Primary key:
- `OfferId`

Columns:
- `OfferId` `UNIQUEIDENTIFIER` PK
- `OfferCode` `NVARCHAR(50)`
- `OfferName` `NVARCHAR(200)`
- `OfferType` `NVARCHAR(100)`
- `Eligibility` `NVARCHAR(200)` nullable
- `DiscountDescription` `NVARCHAR(200)` nullable
- `Status` `NVARCHAR(30)` default `Active`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/offers`

UI:
- Opportunity pricing and quote positioning

### `billing.Promotions`
Primary key:
- `PromotionId`

Columns:
- `PromotionId` `UNIQUEIDENTIFIER` PK
- `PromotionCode` `NVARCHAR(50)`
- `PromotionName` `NVARCHAR(200)`
- `PromotionType` `NVARCHAR(100)`
- `DiscountPct` `DECIMAL(9,2)` nullable
- `Status` `NVARCHAR(30)` default `Active`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/promotions`

UI:
- Opportunity pricing and quotes

### `billing.RatePlans`
Primary key:
- `RatePlanId`

Columns:
- `RatePlanId` `UNIQUEIDENTIFIER` PK
- `ProductId` `UNIQUEIDENTIFIER` logical FK to `billing.Products.ProductId`
- `PlanCode` `NVARCHAR(50)`
- `PlanName` `NVARCHAR(200)`
- `PlanTier` `NVARCHAR(100)`
- `BillingFrequency` `NVARCHAR(50)`
- `IncludedUnits` `INT` default `0`
- `OveragePricePerUnit` `DECIMAL(18,2)` default `0`
- `MonthlyBaseFee` `DECIMAL(18,2)` default `0`
- `MinimumCommitment` `DECIMAL(18,2)` default `0`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `GET /api/billing/rate-plans`

UI:
- Pricing views and product lookup

### `billing.ServiceLocations`
Primary key:
- `ServiceLocationId`

Columns:
- `ServiceLocationId` `UNIQUEIDENTIFIER` PK
- `CustomerNumber` `NVARCHAR(32)` logical FK to `billing.Customers.CustomerNumber`
- `LocationName` `NVARCHAR(200)`
- `AddressLine1` `NVARCHAR(200)`
- `City` `NVARCHAR(100)`
- `StateProvince` `NVARCHAR(100)`
- `PostalCode` `NVARCHAR(20)`
- `CountryCode` `NVARCHAR(10)`
- `ServiceabilityType` `NVARCHAR(100)`
- `Status` `NVARCHAR(30)` default `Active`
- `CreatedAtUtc` `DATETIME2`
- `UpdatedAtUtc` `DATETIME2`
- `IsDeleted` `BIT`

Used by:
- `POST /api/sales/serviceability/check`

UI:
- Opportunity detail -> address check

## Views

### `ms.vSalesModuleDashboard`
Exposed columns:
- `LeadCount`
- `OpportunityCount`
- `QuoteCount`
- `PendingApprovalCount`
- `ContractCount`
- `PipelineValue`
- `QuoteMrcValue`

Purpose:
- Sales landing summary strip and work queue metrics

### `ms.vLeadDetail`
Exposed columns:
- all `ms.Leads` columns
- `ActivityCount`
- `CustomerName`
- `CustomerType`
- `Industry`
- `Region`
- `BillingProfile`

Purpose:
- Lead landing list and lead detail screen

### `ms.vOpportunityDetail`
Exposed columns:
- all `ms.Opportunities` columns
- `AccountNameResolved`
- `AccountNumberResolved`
- `AccountSegment`
- `AccountRegion`
- `ProductCount`
- `ServiceCount`
- `NoteCount`
- `QuoteCount`
- `ApprovalCount`
- `ContractCount`
- `ProductSummaryResolved`
- `ServiceSummaryResolved`

Purpose:
- Opportunity landing list and opportunity detail screen

### `ms.vQuoteDetail`
Exposed columns:
- all `ms.Quotes` columns
- `OpportunityName`
- `AccountName`
- `LineItemCount`
- `LineSummary`

Purpose:
- Quote landing list and quote detail screen

### `ms.vContractDetail`
Exposed columns:
- all `ms.Contracts` columns
- `OpportunityName`
- `QuoteNumber`
- `AccountName`
- `FileCount`

Purpose:
- Contract landing list and contract detail screen

### `billing.vCustomerLookup`
Exposed columns:
- `CustomerNumber`
- `CustomerName`
- `CustomerType`
- `Industry`
- `Region`
- `CountryCode`
- `CustomerStatus`
- `CreditRating`
- `BillingProfile`
- `PrimaryContact`
- `Mrr`
- `AccountManager`
- `Segment`
- `SupportTier`
- `Notes`

Purpose:
- Account lookup, lead conversion, bootstrap payload

### `billing.vCustomerPricingProfile`
Exposed columns:
- `CustomerNumber`
- `CustomerName`
- `CustomerType`
- `Industry`
- `Region`
- `CountryCode`
- `Status`
- `Mrr`
- `PlanName`
- `PlanTier`
- `MonthlyBaseFee`
- `OveragePricePerUnit`
- `MinimumCommitment`

Purpose:
- Pricing context and reference pricing decisions

### `billing.vProductBillingHierarchy`
Exposed columns:
- `ProductId`
- `ProductCode`
- `ProductName`
- `Category`
- `ServiceCategory`
- `BillingCode`
- `ParentProductId`
- `HierarchyPath`
- `DisplayOrder`

Purpose:
- Opportunity pricing and product hierarchy display

### `ms.vCustomerLookup`
Exposed columns:
- `CustomerNumber`
- `CustomerName`
- `CustomerType`
- `IndustryType`
- `CustomerRegion`
- `CountryCode`
- `CustomerStatus`
- `CreditRating`

Purpose:
- Internal sales customer lookup helper

### `ms.vPricingContext`
Exposed columns:
- `CustomerNumber`
- `CustomerName`
- `CustomerType`
- `Industry`
- `Region`
- `CountryCode`
- `CustomerStatus`
- `CreditRating`
- `SubscriptionNumber`
- `DiscountPercent`
- `SubscriptionQuantity`
- `PlanTier`
- `PlanName`
- `IncludedUnits`
- `OveragePricePerUnit`
- `MonthlyBaseFee`
- `MinimumCommitment`
- `ServiceCode`
- `ServiceName`
- `ServiceCategory`
- `IsUsageBased`
- `IsRecurring`
- `BaseListPrice`
- `PaidInvoiceCount`
- `TotalInvoiceCount`
- `OverdueInvoiceCount`
- `FailedPaymentCount`
- `TotalPaymentCount`
- `TotalDiscountGiven`
- `TotalInvoiceAmount`
- `RecentUsageVolume30Days`
- `RecentUsageEventCount30Days`

Purpose:
- Pricing engine input context for quote pricing

## API Map

Sales endpoints:
- Leads: `/api/sales/leads*`
- Accounts: `/api/sales/accounts*`
- Opportunities: `/api/sales/opportunities*`
- Custom Pricing: `/api/sales/custom-pricing*`
- Quotes: `/api/sales/quotes*`
- Approvals: `/api/sales/approvals*`
- Contracts: `/api/sales/contracts*`
- Serviceability: `/api/sales/serviceability/check`
- Bootstrap: `/api/sales/bootstrap`

Billing endpoints:
- Customers: `/api/billing/customers*`
- Products: `/api/billing/products*`
- Product hierarchy: `/api/billing/product-hierarchy`
- Billing codes: `/api/billing/billing-codes`
- Billing elements: `/api/billing/billing-elements`
- Offers: `/api/billing/offers`
- Promotions: `/api/billing/promotions`
- Rate plans: `/api/billing/rate-plans`

## UI Mapping

Sales landing:
- Pulls `dashboard`, `leads`, `accounts`, `opportunities`, `quotes`, `custom pricing`, `approvals`, `contracts`, and billing reference data from `/api/sales/bootstrap`.

Lead detail:
- Reads lead and activity records.
- Writes lead edits, activity logs, and convert-to-opportunity actions.

Opportunity detail:
- Reads opportunity, products, notes, quotes, contracts, and billing hierarchy data.
- Writes service/product changes, notes, activity logs, quote generation, and serviceability checks.

Quote detail:
- Reads quote and line items.
- Writes pricing updates, line item add/edit/delete, approval submission, and contract/order start flow.

Contract detail:
- Reads contract, files, and history.
- Writes contract metadata, file metadata, and history events.

## Notes

- Foreign keys are modeled logically in the API layer and views, but the schema file does not currently declare every SQL foreign key constraint explicitly.
- Most workflow tables support `CreatedAtUtc`, `UpdatedAtUtc`, and `IsDeleted` for soft delete and auditability.
- The live app uses the backend APIs as the only path between the UI and Azure SQL.
