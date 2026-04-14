# Billing-Context-Aware Pricing Implementation

## Architecture Overview

This implementation enables **customer-aware pricing** for the billing demo system by integrating billing schema data directly into pricing decisions. The system uses two distinct database views to separate concerns:

```
Web UI Account Lookup                 Pricing Algorithm
        ↓                                     ↓
        └─→ ms.vCustomerLookup        ms.vPricingContext ←─┐
                    ↓                          ↓          │
            Returns 8 fields         Returns 35+ fields   │
          (auto-fill UI form)        (all billing signals)│
                    ↓                          ↓          │
            lookup_customer_profile  fetch_billing_context_for_pricing
                    ↓                          ↓          │
            CustomerProfileResponse   Merged context dict │
            (customerType, etc)       (includes all signals)
                    │                          │          │
                    └──────────────────────────┴──────────┘
                           calculate_price()
                              Returns pricing
                         with comprehensive explanation
```

## Database Views

### 1. ms.vCustomerLookup (8 fields)
**Purpose:** Web UI auto-fill when customer account number is entered

**Fields returned:**
- CustomerNumber
- CustomerName
- CustomerType (Enterprise, SMB, etc)
- IndustryType (Tech, Finance, Healthcare, etc)
- CustomerRegion (US, EU, APAC, etc)
- CountryCode (US, GB, DE, etc)
- CustomerStatus (Active, Suspended, Churned)
- CreditRating (numerical credit score 0-999)

**Query pattern:** Uses numeric-only matching on customer number
```sql
SELECT ... 
WHERE CustomerNumber LIKE '%12345%'
ORDER BY CustomerNumber DESC
```

### 2. ms.vPricingContext (35+ fields)
**Purpose:** Comprehensive billing signals for pricing algorithm

**Field categories:**

**Customer Profile:**
- CustomerNumber, CustomerName
- CustomerType, Industry (IndustryType), Region, CountryCode
- CustomerStatus, CreditRating

**Current Subscription:**
- SubscriptionNumber, DiscountPercent, SubscriptionQuantity
- PlanTier, PlanName, IncludedUnits, OveragePricePerUnit
- ServiceCode, ServiceName, ServiceCategory
- IsUsageBased, IsRecurring, BaseListPrice

**Billing Health Signals:**
- PaidInvoiceCount / TotalInvoiceCount → invoice health score
- OverdueInvoiceCount → risk signal
- FailedPaymentCount / TotalPaymentCount → payment reliability score
- TotalDiscountGiven / TotalInvoiceAmount → average discount %

**Usage Patterns (30 days):**
- RecentUsageVolume30Days → scaling factor
- RecentUsageEventCount30Days → activity indicator
- IncludedUnits → reference for intensity calculation

**Plan Economics:**
- MonthlyBaseFee, MinimumCommitment
- OveragePricePerUnit, BaseListPrice

## Backend Implementation

### Modified Files

#### 1. app/services/context.py
**New functions:**

```python
_extract_numeric_portion(customer_number: str) -> str
    # Extract digits for flexible account matching
    # E.g. "CUST-12345" → "12345"

lookup_customer_profile(account_id: str) -> dict | None
    # Queries ms.vCustomerLookup for Web UI auto-fill
    # Returns: 8-field customer profile or None
    
fetch_billing_context_for_pricing(account_id: str) -> dict | None
    # Queries ms.vPricingContext for pricing algorithm
    # Returns: 35+ billing context fields or None
    # Calculates derived signals from raw data:
    #   - invoice_health_score = paid_invoices / total_invoices
    #   - payment_reliability_score = successful_payments / total_payments
    #   - average_discount_pct = total_discounts / total_invoice_amount
    #   - usage_intensity = recent_volume / included_units
    
fetch_billing_context(payload, account_id) -> dict
    # Main context builder: combines query metrics + billing signals
    # Priority: lookup(account_id) > payload > default
```

**Key changes:**
- Removed old billing table joins (Customers, Subscriptions, etc)
- Now relies entirely on pre-built views
- Views handle all data aggregation; backend just reads
- Graceful fallback: if no customer found, uses query-only context

#### 2. app/services/pricing.py
**Pricing algorithm enhancements:**

**New adjustment factors:**

```python
invoice_health_adj
    # Based on invoice payment consistency
    # < 0.60: +0.06  |  0.60-0.80: +0.03  |  1.0: -0.02

payment_adj
    # Enhanced with nuanced payment reliability
    # < 0.70: +0.08  |  0.70-0.85: +0.04  |  >= 0.95: -0.02
    # Plus overdue/failed payment counts: +0.02 to +0.05 each

discount_adj
    # More granular discount tier adjustments
    # >= 20%: +0.08  |  >= 15%: +0.05  |  >= 10%: +0.03  |  <= 2%: -0.02

usage_adj
    # Enhanced usage-based scaling
    # >= 100k: +0.06 |  >= 50k: +0.04  |  >= 25k: +0.03  |  <= 5k: -0.02
    # Plus intensity component when intensity >= 0.8: +0.04
```

**Multiplier calculation:**
```
multiplier = 1.0 
    + duration_adj       (query performance)
    + demand_adj         (market demand)
    + inventory_adj      (availability)
    + query_type_adj     (operation complexity)
    + customer_adj       (customer profile/status)
    + service_adj        (service value)
    + plan_adj           (plan tier)
    + discount_adj       (discount history)
    + payment_adj        (payment reliability + risk)
    + usage_adj          (recent volume + intensity)
    + invoice_health_adj (billing payment consistency)
    + manual_adj         (user override)

estimated_cost = base_cost × multiplier
recommended_price = estimated_cost / (1.0 - target_margin)
```

**Explanation enrichment:**
Now includes customer name, usage signals, and billing health metrics in pricing explanation.

#### 3. app/models.py
**Updated CustomerProfileResponse:**
- Now returns exactly 8 fields from ms.vCustomerLookup
- Matches Web UI auto-fill needs
- Removed unnecessary billing context fields
- Added comprehensive docstring

#### 4. app/main.py
**API endpoints (already in place):**

```
GET /customers/{customer_number}
    Response: CustomerProfileResponse (8 fields for UI auto-fill)
    Uses: lookup_customer_profile()
    
GET /accounts/{account_id}
    Alias for /customers/{account_id}
```

#### 5. app/services/quotes.py
**Integration points:**

```python
create_quote(request)
    # Calls: fetch_billing_context(payload, request.opportunity.accountId)
    # Uses: opportunity.accountId for customer-aware pricing
    
revise_quote(quote_id, request)
    # Retrieves: original opportunity.accountId
    # Calls: fetch_billing_context(payload, opportunity_account_id)
    # Result: repricing uses same customer context

reprice_opportunity(opportunity_id, request)
    # Finds: current quote for opportunity
    # Calls: revise_quote() with same account context
```

### Web UI Integration

#### Web UI/assets/config.js
```javascript
accountDetails: "/customers/{accountId}"
```

#### Web UI/assets/app.js
**Account lookup flow:**

```
User enters account number (e.g., "CUST-12345")
         ↓
Account blur event triggered
         ↓
Numeric portion extracted ("12345")
         ↓
API call: GET /customers/CUST-12345
         ↓
Network response (or error/404)
         ↓
Match found?
    ├─ YES: Auto-fill fields
    │       - customerType          → Customer Type dropdown
    │       - industryType          → Industry Type dropdown
    │       - customerRegion        → Region dropdown
    │       - countryCode           → Country Code field
    │       - customerStatus        → Status field (read-only badge)
    │       - creditRating          → Credit Rating display
    │       Show: "Account found and customer details filled in"
    │
    └─ NO:  Clear auto-filled fields
            Show: "No matching account found. You can still enter fields manually."
```

## Data Flow: Quote Creation

### Scenario: Create quote for customer with billing history

```
Request:
{
  "opportunity": {
    "opportunityName": "ABC Corp Data Platform",
    "accountId": "CUST-98765",
    "accountName": "ABC Corp"
  },
  "billingContext": {
    "queryType": "SELECT",
    "executionCount": 150,
    "avgDurationMinutes": 2.5,
    "avgCpuSeconds": 12.8,
    "rowsQueried": 500000
  },
  "pricingInput": {
    "targetMarginPctInput": 45,
    "demandIndexInput": 110,
    "inventoryQtyInput": 85
  }
}

Processing:
1. extract_numeric_portion("CUST-98765") → "98765"
2. fetch_billing_context_for_pricing("CUST-98765")
   └─ Query ms.vPricingContext WHERE CustomerNumber LIKE '%98765%'
   └─ Returns: 35+ fields including customer, subscription, billing signals
3. Calculate derived signals:
   - customer ABC Corp: Enterprise type, Finance industry, Active, credit 780
   - subscription: Premium plan, Analytics service, 20% existing discount
   - billing signals: 95% invoice payment rate, 98% payment reliability, 15% avg discount
   - recent usage: 450k units in 30 days (vs 100k included = 4.5x intense)
4. calculate_price() with enriched context:
   - Base cost from query metrics
   - customer_adj: -0.06 (Enterprise active good credit)
   - service_adj: +0.05 (Analytics is premium)
   - plan_adj: +0.06 (Premium tier)
   - discount_adj: +0.05 (15% historical discount)
   - payment_adj: -0.01 (98% reliable)
   - usage_adj: +0.08 (450k volume + high intensity)
   - invoice_health_adj: -0.02 (95% payment rate)
   - multiplier: 1.0 + adjustments = ~1.19
5. Final price = base_cost × 1.19 / (1 - 0.45 margin)

Response:
{
  "recommendedPrice": 2850.00,
  "expectedMarginPct": 45.12,
  "finalPrice": 2850.00,
  "score": 0.82,
  "dbLookupUsed": true,
  "pricingExplanation": "Calculated from billing customer context. 
                        Customer 'ABC Corp', type 'Enterprise', 
                        industry 'Finance', region 'US East', 
                        status 'Active' (credit rating 780). 
                        Service 'Data Analytics' category 'Analytics', 
                        plan 'Premium' tier 'Pro'. 
                        Query type 'SELECT' with 150.00 executions... 
                        Billing signals: Invoice health 0.95, 
                        payment reliability 0.98, avg discount 15.00%, 
                        recent usage 450000.00 units, usage intensity 4.50..."
}
```

## Environment Variables

```bash
# Database
AZURE_SQL_SERVER=myserver.database.windows.net
AZURE_SQL_DATABASE=pricing_db
AZURE_SQL_USERNAME=sqluser
AZURE_SQL_PASSWORD=...

# Optional: Override view names if different
CUSTOMER_LOOKUP_VIEW=ms.vCustomerLookup
PRICING_CONTEXT_VIEW=ms.vPricingContext
```

## Error Handling

### When customer not found:
- `lookup_customer_profile()` returns `None`
- `fetch_billing_context()` falls back to query-only context
- Pricing still completes using query metrics
- Web UI shows: "No matching account found..."
- User can manually enter customer details

### When views don't exist:
- Backend returns HTTP 500 error
- Check: Have migrations been executed?
- Verify: `SELECT * FROM ms.vCustomerLookup` in SSMS

### Network errors:
- Connection timeout: Check Azure SQL firewall rules
- Auth errors: Verify credentials and DefaultAzureCredential setup
- Parsing errors: Check view column names match exactly

## Testing Checklist

- [ ] Execute schema migration: `python run_schema_migration.py`
- [ ] Verify views exist in SSMS
- [ ] Test customer lookup API: `curl https://api/customers/CUST-12345`
- [ ] Test auto-fill in Web UI with known customer
- [ ] Create quote for customer with billing history
- [ ] Verify pricing explanation includes billing signals
- [ ] Test fallback when customer not found
- [ ] Test repricing reuses customer context
- [ ] Check margin calculations match expectations

## Performance Considerations

- **View indexes:** Ensure indexes on billing schema tables
  - `billing.Customers.CustomerNumber`
  - `billing.Subscriptions.CustomerId, StartDate`
  - `billing.Invoices.CustomerId, InvoiceStatus`
  - `billing.Payments.CustomerId, PaymentStatus`
  - `billing.UsageEvents.CustomerId, EventTimestamp`

- **Query caching:** Views aggregate data at read-time
  - Consider materialized views if performance becomes issue
  - View performance depends entirely on underlying billing tables

- **Connection pooling:** Python pyodbc uses connection pooling
  - Current implementation: 1 connection per request (closed after)
  - Can be optimized with connection pool if needed

## Future Enhancements

1. **Predictive scoring:** ML model for customer churn/expansion risk
2. **Seasonal adjustment:** Time-of-year pricing based on usage patterns
3. **Competitive positioning:** Market basket analysis from similar customers
4. **Volume discounts:** Auto-tier pricing based on projected consumption
5. **Scenario analysis:** "What-if" pricing experiments with different customer profiles
6. **Usage forecasting:** Predict customer's future volume for committed pricing
