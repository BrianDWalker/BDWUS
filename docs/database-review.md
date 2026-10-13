# SQL build and production reconciliation

Owner approved all prepared changes on 12 October 2026. Production resumed after the read-only catalog request; no firewall or tier changes were made. The catalog contained 52 user tables, 12 views, no stored procedures or user-defined functions, and no foreign keys. `production_baseline.sql` versions the actual table columns/defaults/identities, indexes/constraints and view definitions, without copying customer data. The dev manifest now uses this baseline followed by the additive billing migration. Historical sales_schema.sql, phase2_schema_hardening.sql and assistant_schema.sql remain for reference; they are not competing build entry points.

The single guarded runner prints SQL by default and refuses all targets except AZBDWUSDEV. It successfully built dev from scratch. The explicit dev-only seeder populated demo records in core sales/catalog/ops/care tables. Production received only the separately shown additive billing migration and runtime identity grants; existing tables and customer data were not rewritten. Both databases now have 55 tables.

`billing_facts_proposal.sql` is the owner-approved additive migration for Subscriptions, Payments, UsageEvents and their three portal views. Its name is retained for the original review link. The views return actual table records; newly created tables are empty until real data is entered. No stored procedures are required for those paginated read-only endpoints.

`grant_portal_access.sql` grants per-environment managed identities schema-scoped data permissions without db_owner or db_ddladmin. Creating users as the existing human Entra administrator succeeded without additional directory-wide permissions. No grants are hidden in automatic deployment hooks.

The historical ms.vPricingContext view contains synthesized subscription identifiers and fixed pricing statistics. It is preserved in the schema baseline for compatibility, but the new billing facts endpoints do not use it. Do not use it as a financial ledger. Legacy singular ms.Opportunity/ms.QuoteRequest/ms.QuoteHistory do not exist in production; the active sales routes use the plural tables.

```sh
python scripts/migrate_azure_sql_db.py > /tmp/bdwus-dev-review.sql
python scripts/migrate_azure_sql_db.py --target-db AZBDWUSDEV --apply
```

Local SQL access needs Microsoft ODBC 18, Azure CLI sign-in, SQL Entra permissions and an existing network route. Runtime access uses the assigned managed identity. Never apply the full baseline to production.
