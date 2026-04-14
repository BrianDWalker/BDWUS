# Deployment and Testing Guide

## Pre-Deployment Checklist

### Database Prerequisites
- [ ] Azure SQL database is accessible and empty (or has billing schema)
- [ ] Azure SQL Server firewall allows connection from your network
- [ ] SQL credentials: `AZURE_SQL_SERVER`, `AZURE_SQL_USERNAME`, `AZURE_SQL_PASSWORD` 
- [ ] Database name: `AZURE_SQL_DATABASE` environment variable set

### Code Prerequisites
- [ ] All Python files updated (context.py, pricing.py, models.py, quotes.py)
- [ ] Web UI config.js has correct API base URL
- [ ] No syntax errors (validated Python modules)
- [ ] All imports present and correct

## Step 1: Create Database Schema

### Run Migration Script
```bash
cd pricing-microservice

# Set environment variables first
export AZURE_SQL_SERVER="myserver.database.windows.net"
export AZURE_SQL_DATABASE="pricing_db"
export AZURE_SQL_USERNAME="sqluser"
export AZURE_SQL_PASSWORD="yourpassword"

# Execute migrations
python3 run_schema_migration.py

# Expected output:
# Connecting to Azure SQL...
# ✓ Connected to [server] / [database]
# Reading migration file...
# ✓ Executing: DROP VIEW IF EXISTS ms.vCustomerLookup
# ✓ Executing: CREATE VIEW ms.vCustomerLookup AS ...
# ✓ Executing: DROP VIEW IF EXISTS ms.vPricingContext
# ✓ Executing: CREATE VIEW ms.vPricingContext AS ...
# ✓ Executing: ALTER TABLE ms.Opportunity ADD COLUMN ...
# ✓ Migration completed successfully
```

### Validate Schema in SSMS
```sql
-- Verify views exist
SELECT * FROM ms.vCustomerLookup LIMIT 1;
SELECT * FROM ms.vPricingContext LIMIT 1;

-- Verify metadata columns exist
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Opportunity' AND COLUMN_NAME LIKE '%Metadata%';

-- Check billing schema tables have sample data
SELECT COUNT(*) FROM billing.Customers;
SELECT COUNT(*) FROM billing.Subscriptions;
SELECT COUNT(*) FROM billing.Invoices;
SELECT COUNT(*) FROM billing.Payments;
SELECT COUNT(*) FROM billing.UsageEvents;
```

## Step 2: Deploy Backend Microservice

### Build Docker Image
```bash
cd pricing-microservice

# Build
docker build -t pricing-microservice:v4.0 .

# Tag for ACR
docker tag pricing-microservice:v4.0 myacr.azurecr.io/pricing-microservice:v4.0

# Push to Azure Container Registry
docker push myacr.azurecr.io/pricing-microservice:v4.0
```

### Deploy to Azure Container Apps
```bash
# Using Azure CLI
az containerapp create \
  --name pricing-service \
  --resource-group my-rg \
  --image myacr.azurecr.io/pricing-microservice:v4.0 \
  --target-port 8000 \
  --ingress 'external' \
  --env-vars \
    AZURE_SQL_SERVER=myserver.database.windows.net \
    AZURE_SQL_DATABASE=pricing_db \
    AZURE_SQL_USERNAME=sqluser \
    AZURE_SQL_PASSWORD=$PASSWORD \
    CUSTOMER_LOOKUP_VIEW=ms.vCustomerLookup \
    PRICING_CONTEXT_VIEW=ms.vPricingContext
```

### Verify Deployment
```bash
# Check service is running
curl https://myservice.region.azurecontainerapps.io/health

# Expected response:
# {"status": "healthy"}

# Check database connection
curl https://myservice.region.azurecontainerapps.io/health/pricing-context

# Expected response:
# {
#   "status": "healthy",
#   "billingContextObject": "ms.vBillingPricingContext",
#   "sampleRowFound": true
# }
```

## Step 3: Test Customer Lookup Endpoint

### Test with cURL
```bash
ACCOUNT_NUM="CUST-12345"  # Use actual customer number from billing data
API_URL="https://myservice.region.azurecontainerapps.io"

# Test lookup
curl -X GET "$API_URL/customers/$ACCOUNT_NUM"

# Expected response (HTTP 200):
{
  "customerNumber": "CUST-12345",
  "customerName": "Example Corp",
  "customerType": "Enterprise",
  "industryType": "Finance",
  "customerRegion": "US East",
  "countryCode": "US",
  "customerStatus": "Active",
  "creditRating": 750
}

# Test not found (HTTP 404):
curl -X GET "$API_URL/customers/CUST-99999"
# {"detail": "Customer not found."}
```

### Test with Python
```python
import requests

API_URL = "https://myservice.region.azurecontainerapps.io"
account_num = "CUST-12345"

response = requests.get(f"{API_URL}/customers/{account_num}")
if response.status_code == 200:
    print(f"Found: {response.json()}")
else:
    print(f"Not found: {response.json()}")
```

## Step 4: Test Web UI Auto-Fill

### Manual Browser Testing
1. Open `index.html` in browser
2. Scroll to "Account Number" field
3. Enter a customer number: `CUST-12345`
4. Press Tab or click elsewhere
5. Observe:
   - Account lookup message appears (loading indicator)
   - If found: Fields auto-fill (green background)
   - If not found: Note says "No matching account..."
   - Can manually edit any field

### Automated Web UI Testing
```javascript
// In browser console
async function testAccountLookup() {
  const accountInput = document.getElementById("accountNumber");
  accountInput.value = "CUST-12345";
  accountInput.dispatchEvent(new Event("blur"));
  
  // Wait 1 second for API response
  await new Promise(r => setTimeout(r, 1000));
  
  // Check if fields were filled
  console.log("Customer Type:", document.getElementById("customerType").value);
  console.log("Industry Type:", document.getElementById("industryType").value);
  console.log("Region:", document.getElementById("customerRegion").value);
}

testAccountLookup();
```

## Step 5: End-to-End Quote Creation Test

### Test Quote Creation with Customer Context
```bash
curl -X POST https://myservice.region/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity": {
      "opportunityName": "Data Platform Deal",
      "accountId": "CUST-12345",
      "accountName": "Example Corp",
      "status": "Open"
    },
    "billingContext": {
      "queryType": "SELECT",
      "executionCount": 150,
      "avgDurationMinutes": 2.5,
      "avgCpuSeconds": 12.8,
      "avgRowCount": 50000,
      "rowsQueried": 500000,
      "rowsInserted": 0,
      "rowsUpdated": 0,
      "rowsDeleted": 0,
      "rowsMerged": 0
    },
    "pricingInput": {
      "targetMarginPctInput": 45,
      "manualAdjustmentPctInput": 0,
      "demandIndexInput": 110,
      "inventoryQtyInput": 85
    }
  }'

# Expected response (HTTP 200):
{
  "opportunityId": "550e8400-e29b-41d4-a716-446655440000",
  "quoteId": "550e8400-e29b-41d4-a716-446655440001",
  "versionNo": 1,
  "pricing": {
    "recommendedPrice": 2850.00,
    "expectedMarginPct": 45.12,
    "priceFloor": 1425.00,
    "priceCeiling": 3420.00,
    "finalPrice": 2850.00,
    "score": 0.82,
    "pricingMessage": "Billing-based pricing...",
    "pricingExplanation": "Calculated from billing customer context. 
                          Customer 'Example Corp', type 'Enterprise'...",
    "dbLookupUsed": true,
    "inputsSummary": { ... }
  }
}
```

### Verify Pricing Explanation Includes Billing Signals
Check that `pricingExplanation` field contains:
- ✓ Customer name and type
- ✓ Industry type and region
- ✓ Service category and plan tier
- ✓ Query metrics (duration, CPU, rows)
- ✓ **NEW** Billing signals (invoice health, payment reliability, discount history)
- ✓ **NEW** Usage intensity metrics
- ✓ Market signals (demand index, inventory)

## Step 6: Test Repricing with Same Customer Context

### Reprice Quote
```bash
QUOTE_ID="550e8400-e29b-41d4-a716-446655440001"

curl -X POST https://myservice.region/quotes/$QUOTE_ID/reprice \
  -H "Content-Type: application/json" \
  -d '{
    "changeType": "Repriced",
    "billingContext": {
      "queryType": "SELECT",
      "executionCount": 200,  # Changed from 150
      "avgDurationMinutes": 3.0,  # Changed from 2.5
      "avgCpuSeconds": 14.2,  # Changed from 12.8
      "rowsQueried": 600000  # Changed from 500000
    },
    "pricingInput": {
      "targetMarginPctInput": 45
    },
    "changedBy": "sales@example.com"
  }'

# Response should:
# - Use SAME customer context (re-queried from database)
# - Calculate NEW price with updated metrics
# - Show improved pricing explanation with customer context
# - Mark as "Repriced" in QuoteHistory
```

## Common Issues and Troubleshooting

### Issue: 404 Customer Not Found
```
Response: {"detail": "Customer not found."}
Status: 404
```
**Solutions:**
1. Verify customer exists in `billing.Customers` table
2. Check numeric portion extraction: "CUST-12345" → "12345"
3. Run view directly in SSMS: 
   ```sql
   SELECT * FROM ms.vCustomerLookup WHERE CustomerNumber LIKE '%12345%'
   ```
4. Ensure ms.vCustomerLookup view was successfully created

### Issue: View Missing or Doesn't Exist
```
Error: [SQL Server Native Client] [SQL Server] Invalid object name 'ms.vCustomerLookup'
```

**Solutions:**
1. Run migration script again: `python3 run_schema_migration.py`
2. Check migration output for errors
3. Verify in SSMS:
   ```sql
   SELECT * FROM sys.views WHERE name LIKE '%vCustomer%'
   ```
4. Check that ms schema exists:
   ```sql
   SELECT * FROM sys.schemas WHERE name = 'ms'
   ```

### Issue: Column X Doesn't Exist in View
```
Error: [SQL Server Native Client] [SQL Server] Invalid column name 'CustomerName'
```

**Solutions:**
1. View schema in SSMS:
   ```sql
   SELECT COLUMN_NAME, DATA_TYPE 
   FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME = 'vCustomerLookup'
   ```
2. Compare with expected columns from schema file
3. Billing source tables may use different column names
4. Update view definition to use correct column names

### Issue: Web UI Not Getting Account Lookup Response
**Symptoms:** 
- Account lookup message doesn't appear
- Timeout after 5 seconds
- Console shows CORS errors

**Solutions:**
1. Check API base URL in config.js matches actual service
2. Verify CORS middleware is running:
   ```python
   app.add_middleware(CORSMiddleware, allow_origins=["*"])
   ```
3. Check browser console for network errors
4. Test API directly with cURL first
5. Verify service is publicly accessible (not behind firewall)

### Issue: Pricing Score is Low (< 0.70)
**Possible causes:**
- Missing input values (null/undefined)
- Customer has poor payment history
- High discount percentage triggering risk adjustment
- Very low recent usage causing conservative pricing

**Verification:**
```python
# Check context dict has all required fields
print(context.keys())
print(f"dbLookupUsed: {context.get('dbLookupUsed')}")
print(f"Invoice health: {context.get('invoiceHealthScore')}")
print(f"Payment reliability: {context.get('paymentReliabilityScore')}")
```

## Rollback Procedure

If issues occur in production:

### 1. Revert to Query-Only Pricing
```python
# In context.py, modify fetch_billing_context to skip customer lookup:
def fetch_billing_context(payload, account_id=None):
    # Skip: if account_id: ...
    return {"dbLookupUsed": False, **payload}
```

### 2. Disable View Dependencies
```python
# In context.py, wrap view queries in try/except:
try:
    row = conn.cursor().execute(f"SELECT ... FROM {PRICING_CONTEXT_VIEW}")
except:
    return None  # Fall back to query-only pricing
```

### 3. Drop Views (if needed)
```sql
DROP VIEW IF EXISTS ms.vPricingContext;
DROP VIEW IF EXISTS ms.vCustomerLookup;
```

## Performance Baselines

Target metrics (after deployment):

- **Customer lookup API:** < 100ms (includes DB query + network)
- **Pricing calculation:** < 50ms
- **Total quote creation:** < 500ms
- **Auto-fill in browser:** < 1 second (API + rendering)
- **Repricing:** < 500ms (same as creation)

Monitor with:
```python
import time
start = time.time()
profile = lookup_customer_profile("CUST-12345")
elapsed = (time.time() - start) * 1000
print(f"Lookup took {elapsed:.1f}ms")
```

## Success Criteria

- [ ] Schema migration completes without errors
- [ ] Views exist and have data
- [ ] Customer lookup API returns correct data
- [ ] Web UI auto-fill populates all 6 fields
- [ ] Quote pricing explanation includes billing signals
- [ ] Repricing reuses customer context appropriately
- [ ] Performance meets baseline thresholds
- [ ] Error handling doesn't crash API
- [ ] Database connection pooling works
