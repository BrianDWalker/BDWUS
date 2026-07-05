# fc-gpt Phase 3 API Contracts

Phase 3 goal: make the backend API the production path for SQL-backed platform reads and start removing frontend dependency on local mock data where the API now has durable Azure SQL objects.

## Completed

- Added shared SQL helper module: `pricing-microservice/app/services/sql_access.py`.
- Moved platform report/admin/Knowledge reads onto Azure SQL-backed helper functions.
- Added SQL-backed platform Knowledge endpoints:
  - `GET /api/platform/knowledge/bootstrap`
  - `GET /api/platform/knowledge/documents`
  - `GET /api/platform/knowledge/topics`
- Updated platform report definitions to read `report.vReportDefinitions` in production.
- Updated platform bootstrap to include SQL-backed report definitions, users, roles, and integrations.
- Updated administration summary to include SQL-backed users, roles, and integrations.
- Updated the Knowledge module to call the platform API instead of importing `mockData.js`.
- Kept `smoke_data` as the explicit smoke-mode fixture source.

## API Read Contracts

Platform SQL-backed reads now use these objects:

| API surface | SQL source |
| --- | --- |
| `/api/platform/reports/definitions` | `report.vReportDefinitions` |
| `/api/platform/reports/{report_id}` | `report.vReportDefinitions` plus existing sales/billing report queries |
| `/api/platform/administration/summary` | `admin.Users`, `admin.Roles`, `admin.Integrations` |
| `/api/platform/bootstrap` | sales bootstrap plus SQL-backed report/admin slices |
| `/api/platform/knowledge/bootstrap` | `knowledge.Documents`, `knowledge.Topics`, `knowledge.DocumentTopics` |
| `/api/platform/knowledge/documents` | `knowledge.Documents`, `knowledge.DocumentTopics`, `knowledge.Topics` |
| `/api/platform/knowledge/topics` | `knowledge.Topics` |

## Live Azure SQL Validation

Command:

```bash
PYTHONPATH=pricing-microservice python3 - <<'PY'
from app.services import platform
print('reports', len(platform.report_definitions()))
print('knowledge_docs', len(platform.knowledge_documents()))
print('knowledge_topics', len(platform.knowledge_topics()))
print('admin_users', len(platform.admin_users()))
print('admin_roles', len(platform.admin_roles()))
print('admin_integrations', len(platform.admin_integrations()))
PY
```

Result:

| Probe | Count |
| --- | ---: |
| reports | 3 |
| knowledge_docs | 5 |
| knowledge_topics | 4 |
| admin_users | 3 |
| admin_roles | 2 |
| admin_integrations | 2 |

## Validation Notes

Passed:

- `python3 -m py_compile pricing-microservice/app/services/sql_access.py pricing-microservice/app/services/platform.py pricing-microservice/tests/test_platform_smoke.py pricing-microservice/tests/test_backend_contracts.py`
- `npm run build` from `web-ui`
- `git diff --check`
- Live Azure SQL read probes listed above

Blocked locally:

- `PYTHONPATH=pricing-microservice python3 -m pytest -q pricing-microservice/tests/test_platform_smoke.py pricing-microservice/tests/test_backend_contracts.py`

Reason:

- `pytest` is not installed in the local Python environment.

Also blocked:

- Full `app.main` OpenAPI import check.

Reason:

- The local Python environment is missing the `openai` package imported by `app.services.assistant`.

## Still Owned By Later Phases

- Phase 4 should continue replacing frontend `mockData.js` usage module by module.
- Phase 4 should update detail pages that still rely on normalized route fallback data.
- Phase 5 should add backend role enforcement for protected reads and mutations.
- A later deployment pass should include installing runtime/test dependencies locally or validating through CI where dependencies are available.
