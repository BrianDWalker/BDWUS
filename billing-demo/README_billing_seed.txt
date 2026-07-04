# Billing seed script

This package contains a Python seed script that generates coherent, internally linked
billing data and writes it directly into Azure SQL Database. It can also export CSV files
and optionally upload them to Azure Blob Storage.

## Files
- `billing_seed_to_azure_sql.py` — main script
- `requirements.txt` — Python dependencies

## Tables populated
- `billing.Customers`
- `billing.Services`
- `billing.RatePlans`
- `billing.Subscriptions`
- `billing.Invoices`
- `billing.InvoiceLines`
- `billing.Payments`
- `billing.UsageEvents`

## What makes the data coherent
- Customers have realistic types, regions, tax rates, and go-live dates
- Subscriptions are tied to customer type and suitable plan tiers
- Usage events are generated from subscriptions and monthly periods
- Invoice lines are derived from the same monthly usage and recurring fees
- Payments align with invoice status and paid amounts
- Query-oriented metadata is included in usage events via:
  - query type
  - execution counts
  - durations
  - CPU-like cost signals
  - row counts
  - logical/physical-read-inspired behavior
  - timestamps and correlation IDs

## Install
```bash
pip install -r requirements.txt
```

## Required environment variables
```bash
export AZURE_SQL_SERVER='bdwus.database.windows.net'
export AZURE_SQL_DATABASE='AZBDWUSP'
export AZURE_SQL_USERNAME='CloudSA394d0849'
export AZURE_SQL_PASSWORD='BDWUSPWD1!'
```

## Optional environment variables
```bash
export BILLING_SCHEMA='billing'
export SEED_SCALE='medium'
export TRUNCATE_FIRST='true'
export BATCH_SIZE='5000'
export RANDOM_SEED='42'
export WRITE_TO_SQL='true'

export EXPORT_CSV='true'
export EXPORT_DIR='./seed_output'

export UPLOAD_TO_BLOB='false'
export AZURE_BLOB_CONNECTION_STRING='...'
export AZURE_BLOB_CONTAINER='billing-seed'
```

## Run
```bash
python billing_seed_to_azure_sql.py
```

## Suggested first run
Use `SEED_SCALE=small` first, then increase to `medium` or `large`.
