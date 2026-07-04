# Customer-Aware Pricing Microservice: Implementation Guide

## Overview

This guide explains the changes made to support **customer-aware pricing** and **billing-context lookup** in the pricing microservice and Web UI.

### What Changed

The pricing algorithm now considers customer attributes and billing history to generate context-aware quotes:
- **Customer profile**: type, industry, region, credit rating, status
- **Service details**: category, plan tier, service name
- **Billing signals**: payment reliability, invoice health, discount history, usage volume

### Architecture

```
User enters Account # on Web UI
          ↓
    Account Lookup API (/customers/{accountId})
          ↓
  Query billing.Customers table in Azure SQL
          ↓
  Return customer metadata (type, industry, region, etc.)
          ↓
  Pricing algorithm uses this context to adjust price
          ↓
  More accurate, explainable quotes
```

---

## 1. Database Schema Updates

### Execute the Migration

Before using the new pricing service, you must update your Azure SQL schema:

**Option A: Using the Python helper**

```bash
cd /path/to/pricing-microservice

# Set environment variables (required)
export AZURE_SQL_SERVER="your-server.database.windows.net"
export AZURE_SQL_DATABASE="AZBDWUSP"
export AZURE_SQL_USERNAME="your_username"
export AZURE_SQL_PASSWORD="your_password"

# Run the migration
python3 run_schema_migration.py
```

**Option B: Using SQL Server Management Studio or Azure Portal**

1. Open the query editor in Azure Portal or SQL Server Management Studio
2. Copy the contents of `azure_sql_schema_updates.sql`
3. Execute the script against your database

### What the Migration Does

#### 1. Adds customer metadata columns to `ms.Opportunity` table
Stores customer attributes directly on the opportunity for reference:
- `CustomerType` - type of customer (SmallBusiness, MidMarket, Enterprise)
- `IndustryType` - customer's industry (Healthcare, Finance, Retail, etc.)
- `CustomerRegion` - geographic region
- `CountryCode` - country code (US, CA, GB, etc.)
- `CustomerStatus` - account status (Active, Suspended, Churned)
- `CreditRating` - credit score/rating
- `PlanTier` - tier of service plan (Basic, Standard, Pro, Enterprise)
- `PlanName` - human-readable plan name
- `ServiceName` - service being priced
- `ServiceCategory` - category of service (Analytics, API, Storage, etc.)
- `AverageDiscountPct` - average discount given to this customer historically
- `InvoiceHealthScore` - payment reliability (0-1 score)
- `PaymentReliabilityScore` - how often payments are made on time
- `RecentUsageVolume` - recent 30-day usage quantity

#### 2. Adds the same metadata to `ms.QuoteHistory` table
Preserves historical context for each quote so you can see what factors influenced that pricing decision.

#### 3. Creates a view: `billing.vCustomerPricingProfile`
Simplifies customer lookup queries by joining:
- `billing.Customers` - customer master data
- `billing.Subscriptions` - active subscriptions and discounts
- `billing.RatePlans` - plan terms (included units, overage pricing, fees)
- `billing.Services` - service definitions and categories

This view is optional but useful if you want to query customer pricing profiles from other applications.

---

## 2. Backend Changes

### New API Endpoint

**Customer Lookup API**
```
GET /customers/{customer_number}
GET /accounts/{account_id}  (alias for backward compatibility)
```

Returns:
```json
{
  "customerNumber": "12345",
  "customerName": "Acme Corp",
  "customerType": "Enterprise",
  "industryType": "Manufacturing",
  "customerRegion": "East US",
  "countryCode": "US",
  "customerStatus": "Active",
  "creditRating": 750,
  "planTier": "Enterprise",
  "planName": "Enterprise Analytics Plan",
  "serviceName": "Query Analytics",
  "serviceCategory": "Analytics",
  "averageDiscountPct": 12.5,
  "invoiceHealthScore": 0.98,
  "paymentReliabilityScore": 0.95,
  "recentUsageVolume": 145000.0,
  "billingContext": {
    "customerType": "Enterprise",
    "industryType": "Manufacturing",
    "creditRating": 750,
    "invoiceHealthScore": 0.98,
    "paymentReliabilityScore": 0.95,
    ...
  }
}
```

### Modified Pricing Flow

**When creating a quote:**
1. User submits Account Number from Web UI
2. Backend extracts numeric portion (e.g., "CUST-12345" → "12345")
3. Calls `/customers/{accountId}` to retrieve billing profile
4. Pricing algorithm uses customer context to adjust price multiplier
5. Customer-aware factors influence the final price:
   - Enterprise customers may get better rates
   - High-risk accounts may be charged premium
   - Payment-reliable customers may qualify for discounts
   - Heavy usage patterns may justify higher rates

**When repricing an opportunity:**
1. Retrieves the original Account Number from the opportunity
2. Calls customer lookup again (billing signals may have changed)
3. Reprices with latest customer/billing context

### Updated Files

- **app/main.py**
  - Added `/customers/{customer_number}` endpoint
  - Added `/accounts/{account_id}` alias endpoint

- **app/models.py**
  - Added `CustomerProfileResponse` model

- **app/services/context.py**
  - Added `lookup_customer_profile()` function
  - Extended `fetch_billing_context()` to accept `account_id` parameter
  - Now queries customer/billing data and derives pricing signals:
    - Invoice health (paid vs. unpaid invoices)
    - Payment reliability (failed payment ratio)
    - Average discount percentage
    - Recent usage volume and intensity
    - Overage likelihood

- **app/services/pricing.py**
  - Extended `calculate_price()` to use customer context
  - New pricing factors:
    - Customer status and credit rating adjustment
    - Customer segment type (Enterprise gets better rates)
    - Service category premium/discount
    - Plan tier pricing adjustment
    - Historical discount behavior
    - Payment reliability adjustment
    - Recent usage volume adjustment
  - Multipliers are now calculated from customer + billing data
  - Better explanation text includes customer context

- **app/services/quotes.py**
  - `create_quote()` now passes account ID to pricing context
  - `revise_quote()` retrieves account ID from existing opportunity and reuses it

---

## 3. Web UI Changes

### Updated Account Number Lookup

- **Web UI/assets/config.js**
  - Updated `accountDetails` route to `/customers/{accountId}`

- **Web UI/assets/app.js**
  - Enhanced comments explaining numeric extraction from account number
  - Account lookup gracefully handles not-found scenarios
  - User can still enter values manually if no match is found

### How It Works From User Perspective

1. User enters an Existing Account # on the new-quote.html page
2. When they blur (finish typing) the account field:
   - The UI extracts the numeric portion
   - Calls the customer lookup API
   - If found: auto-fills Customer Type, Industry Type, Service Category, Plan Tier
   - If not found: shows message, lets user enter manually
3. User can modify auto-filled fields anytime
4. If user clears the account number: all auto-filled fields clear and become editable

---

## 4. Data Flow Example

### Scenario: Creating a quote for a known customer

```
User Entry:
  Account #: "CUST-12345"
  Opportunity Name: "New Query Analytics Deal"
  Target Margin %: 28.5

Flow:
  1. Web UI extracts "12345" from "CUST-12345"
  2. Calls GET /customers/12345
  3. Backend queries billing.Customers WHERE CustomerNumber LIKE '%12345%'
  4. Finds: Acme Corp, Enterprise, Manufacturing, East US, Credit 750
  5. Also finds: recent subscription to Query Analytics Pro plan
  6. Returns customer profile + billing signals
  
  7. Web UI auto-fills:
     - Customer Type: Enterprise
     - Industry Type: Manufacturing
     - Service Category: Analytics
     - Plan Tier: Pro
  
  8. User clicks "Request Custom Price"
  9. Pricing algorithm runs:
     - Base cost from query context
     - Enterprise customer → -2% adjustment
     - 750 credit rating → -5% adjustment
     - Manufacturing industry → -1% adjustment
     - Pro plan → +6% adjustment
     - 95% payment reliability → -2% adjustment
     - Final price is more accurate because it reflects customer risk profile
  
  10. Result shows quote with explainable pricing reasoning
```

---

## 5. Troubleshooting

### Issue: "No matching account was found"

**Cause:** The customer number wasn't found in `billing.Customers`.

**Solution:**
1. Check if customer exists in Azure SQL: `SELECT * FROM billing.Customers WHERE CustomerNumber LIKE '%{numeric_part}%'`
2. Ensure the numeric portion matches
3. User can enter customer/service fields manually

### Issue: Pricing is the same for different customers

**Cause:** Customer-aware adjustments may be small or canceling out.

**Solution:**
1. Check pricing explanation in the response:
   ```python
   response["pricing"]["pricingExplanation"]
   ```
2. Verify customer profile was retrieved:
   ```python
   response["pricing"]["dbLookupUsed"]  # Should be True if customer found
   ```
3. Review pricing context in logs for customer/billing factors

### Issue: API returns 404 for known customer

**Cause:** Customer number format may not match.

**Solution:**
1. Try with full customer number
2. Try variations (e.g., "12345", "CUST-12345", etc.)
3. Check `billing.Customers.CustomerNumber` values directly

---

## 6. Environment Variables

### For the pricing service (app/main.py)

```bash
# Azure SQL connection
SQL_SERVER=your-server.database.windows.net
SQL_DATABASE=AZBDWUSP

# Billing schema configuration
BILLING_CONTEXT_OBJECT=ms.vBillingPricingContext
BILLING_CUSTOMERS_OBJECT=billing.Customers
BILLING_SUBSCRIPTIONS_OBJECT=billing.Subscriptions
BILLING_RATEPLANS_OBJECT=billing.RatePlans
BILLING_SERVICES_OBJECT=billing.Services
BILLING_INVOICES_OBJECT=billing.Invoices
BILLING_PAYMENTS_OBJECT=billing.Payments
BILLING_USAGE_EVENTS_OBJECT=billing.UsageEvents
```

### For the migration script

```bash
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=AZBDWUSP
AZURE_SQL_USERNAME=username
AZURE_SQL_PASSWORD=password
```

---

## 7. Testing

### Test the Customer Lookup API

```bash
# Using curl
curl -X GET "http://localhost:8000/customers/12345" \
  -H "Content-Type: application/json"

# Expected response (if customer exists)
{
  "customerNumber": "12345",
  "customerType": "Enterprise",
  ...
}

# Expected response (if customer not found)
HTTP 404: Customer not found.
```

### Test Quote Creation with Customer Context

```bash
curl -X POST "http://localhost:8000/quotes" \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity": {
      "opportunityName": "Test Deal",
      "accountId": "12345"
    },
    "billingContext": {},
    "pricingInput": {
      "targetMarginPctInput": 28.5
    }
  }'
```

---

## 8. Summary

**What you need to do:**

1. ✅ Run the schema migration (`run_schema_migration.py` or execute `azure_sql_schema_updates.sql`)
2. ✅ Deploy the updated pricing microservice
3. ✅ Update Web UI config to use new routes
4. ✅ Test customer lookup on the new quote page

**Expected behavior:**

- Users enter account numbers
- Web UI auto-fills customer/service metadata
- Pricing algorithm uses customer context
- Prices are more accurate and explainable
