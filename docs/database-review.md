# SQL review and database gate

Nothing in this change has been applied to Azure SQL. Read the SQL files before approving execution. `sql/manifest.json` is the ordered dev build list; the runner prints SQL by default and refuses all targets except AZBDWUSDEV. It uses the same transactional batch executor as the legacy apply-file entry point. The destructive clone script, whose default target was prod and which dropped tables, has been replaced.

Existing versioned files cover sales/billing catalog, operations, care, administration, reports and knowledge. Assistant runtime DDL is extracted into `assistant_schema.sql`. The app must never execute DDL under its runtime identity. Data-plane permissions are shown separately in `grant_portal_access.sql`; Bicep Contributor roles cannot grant SQL data access. No grant is applied by an azd hook because the owner explicitly requires SQL review before execution.

**Known blocker:** the read-only production catalog connection timed out locally. Exact production schema, procedures, legacy singular ms.Opportunity/ms.QuoteRequest/ms.QuoteHistory, invoice/payment/usage/subscription contracts cannot be reconciled from that inaccessible database. Existing `sales_schema.sql` contains a synthetic ms.vPricingContext view (generated subscription IDs and fixed billing statistics). Do not treat that view as production billing facts or apply it to prod. Dev schema application and parity verification remain pending approval and database connectivity. No prod metadata or data is copied by the runner.

Review the proposed real billing tables/views in `billing_facts_proposal.sql` separately. They are not in the automatic build manifest until the owner confirms the actual production contracts. Stored procedures already present in prod must be exported and versioned after read-only connectivity is restored; new procedures are not inferred from inaccessible data.

After explicit approval, run from pricing-microservice:

```sh
python scripts/migrate_azure_sql_db.py > /tmp/bdwus-dev-review.sql
# Review the SQL above before the next command.
python scripts/migrate_azure_sql_db.py --target-db AZBDWUSDEV --apply
```

Local SQL access needs an installed Microsoft ODBC 18 driver, Azure CLI sign-in, SQL Entra permissions, and an already-approved network route/firewall. No firewall rules have been added.
