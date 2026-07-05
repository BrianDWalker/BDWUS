# fc-gpt Phase 2 Schema Readiness

Phase 2 goal: make the Azure SQL setup source-controlled, idempotent, and ready for API-backed reads and mutations in later phases.

## Completed

- Added source-controlled migration: `pricing-microservice/sql/phase2_schema_hardening.sql`.
- Added reusable SQL runner: `pricing-microservice/scripts/apply_sql_file.py`.
- Added live schema validator: `pricing-microservice/scripts/validate_phase2_schema.py`.
- Applied the migration to `bdwus.database.windows.net` / `AZBDWUSP`.
- Re-ran the migration successfully to confirm idempotence.
- Validated the live database shape successfully.

## Azure SQL Changes Applied

Operational/runtime schemas now have source-controlled DDL coverage:

- `ops`
- `admin`
- `billingops`
- `care`

New durable schemas added:

- `knowledge`
- `report`

New or hardened SQL objects:

- `dbo.SchemaMigrations`
- `report.ReportDefinitions`
- `report.vReportDefinitions`
- `knowledge.Topics`
- `knowledge.Documents`
- `knowledge.DocumentTopics`
- `knowledge.vDocuments`
- additional `UpdatedAtUtc` / `IsDeleted` columns on operational tables where they were missing
- read-path indexes for operations, billing workflow, care tickets, and knowledge documents

Seeded durable reference data:

- `report.ReportDefinitions`: 3 rows
- `knowledge.Topics`: 4 rows
- `knowledge.Documents`: 5 rows
- `billing.BillingElements`: 7 rows

Migration marker:

- `dbo.SchemaMigrations.MigrationId = 'fc-gpt-phase2-schema-hardening'`

## Validation Results

Command:

```bash
PYTHONPATH=pricing-microservice python3 pricing-microservice/scripts/validate_phase2_schema.py
```

Result:

- Phase 2 schema validation passed.
- Required objects exist.
- Required hardening columns exist.
- Minimum row counts passed.
- Migration marker exists.

Live row counts after migration:

| Object | Row count |
| --- | ---: |
| `billing.BillingElements` | 7 |
| `report.ReportDefinitions` | 3 |
| `report.vReportDefinitions` | 3 |
| `knowledge.Topics` | 4 |
| `knowledge.Documents` | 5 |
| `knowledge.vDocuments` | 5 |
| `dbo.SchemaMigrations` | 1 |

## Test Notes

Attempted backend pytest coverage:

```bash
PYTHONPATH=pricing-microservice pytest -q pricing-microservice/tests/test_platform_smoke.py pricing-microservice/tests/test_backend_contracts.py pricing-microservice/tests/test_readiness_care_storage.py pricing-microservice/tests/test_ops_write_contracts.py
python3 -m pytest -q pricing-microservice/tests/test_platform_smoke.py pricing-microservice/tests/test_backend_contracts.py pricing-microservice/tests/test_readiness_care_storage.py pricing-microservice/tests/test_ops_write_contracts.py
```

Both were blocked because `pytest` is not installed in this local Python environment, and `pricing-microservice/requirements.txt` does not currently include it.

Completed non-pytest validation:

- `python3 -m py_compile pricing-microservice/scripts/apply_sql_file.py pricing-microservice/scripts/validate_phase2_schema.py`
- `git diff --check`
- migration apply against live Azure SQL
- migration rerun against live Azure SQL
- live Phase 2 schema validation script

## Still Owned By Later Phases

- Phase 3 should update API reads for report definitions, Knowledge content, and administration summary to use the new SQL objects.
- Phase 3 should decide whether startup-time DDL remains as a defensive fallback or is reduced once migrations are part of deployment.
- Phase 4 should remove production frontend usage of Knowledge mock data after the new Knowledge API exists.
- Phase 5 should enforce backend roles for protected mutations.
