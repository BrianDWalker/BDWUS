# Staging Config And Validation

This document gives GitHub-only agents and CI enough context to validate the app without needing the local desktop environment.

## Branch And App Targets

Primary branch for this work:
- `fc-gpt`

Frontend:
- Project directory: `web-ui`
- Build command: `npm run build`
- Vite env var for API base: `VITE_SALES_API_BASE_URL`
- Fallback env var also supported: `VITE_AI_API_BASE_URL`
- Current hard-coded fallback in `web-ui/src/utils/salesApi.js`: `https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io`

Backend:
- Project directory: `pricing-microservice`
- FastAPI entry: `pricing-microservice/app/main.py`
- Python dependencies: `pricing-microservice/requirements.txt`

## Required Secrets Or Settings

GitHub/Azure validation needs these values configured outside the repo:

| Setting | Purpose |
| --- | --- |
| `VITE_SALES_API_BASE_URL` | Frontend API base URL for the FastAPI service |
| Azure deployment credentials | Required by Azure deployment workflows |
| Azure Container Registry settings | Required if backend images are built and pushed |
| Azure SQL connection settings | Required by backend runtime and integration tests |
| Azure OpenAI / Foundry settings | Required by assistant endpoints if used during validation |
| GitHub token for assistant endpoints | Required by `/api/assistant/github/*` |

Do not commit secret values. Commit only example names and documentation.

## Minimum CI Checks

Run these checks on pushes to `fc-gpt`:

The `fc-gpt Validation` workflow and the `Platform Build Validation` workflow are intentionally configured without push path filters so every commit on `fc-gpt` gets attached validation runs, including documentation-only handoff commits.

`fc-gpt Validation` always runs deployed API smoke jobs. By default they use `https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io`, the Azure Container App staging API for `fc-gpt`. This URL exposes the newer full-platform endpoints, including `/health/ready`, `/api/platform/bootstrap`, and `/api/ops/bootstrap`. Set the repository variable `STAGING_API_BASE_URL` only when the workflow should validate a different API deployment.

`fc-gpt Validation` also runs `full platform runtime smoke`, which starts the current FastAPI app in `PLATFORM_RUNTIME_SMOKE_MODE=1` on `http://127.0.0.1:8000` inside GitHub Actions. This gives a concrete `STAGING_API_BASE_URL` for the current code and proves `/health/ready`, `/api/platform/bootstrap`, and `/api/ops/bootstrap` are reachable at runtime without needing Azure SQL credentials.

`fc-gpt Validation` also runs deployed frontend browser smoke by default against `https://polite-cliff-080b22c0f-previewgpt.eastus2.7.azurestaticapps.net`, the Static Web App preview environment for the `fc-gpt` branch. Set `STAGING_WEB_BASE_URL` only when the workflow should validate a different deployed frontend.

`fc-gpt Validation` also runs a Chromium route smoke suite from `web-ui/tests/portal-routes.spec.js`. That suite mocks API payloads and verifies the extracted routes render without browser console errors. It is not a replacement for live staging, but it gives GitHub-visible runtime evidence for the React route layer.

```bash
cd web-ui
npm ci
npm run build
```

```bash
cd pricing-microservice
python -m pip install -r requirements.txt
python -m compileall app
```

If a full-platform staging API URL is available, add smoke checks:

```bash
curl -fsS "$API_BASE_URL/health"
curl -fsS "$API_BASE_URL/health/ready"
curl -fsS "$API_BASE_URL/health/sales"
curl -fsS "$API_BASE_URL/api/sales/bootstrap"
curl -fsS "$API_BASE_URL/api/billing/customers"
curl -fsS "$API_BASE_URL/api/platform/bootstrap"
curl -fsS "$API_BASE_URL/api/ops/bootstrap"
```

## Manual Browser Validation

After frontend deploy, verify these hash routes:

| Route | Expected result |
| --- | --- |
| `#/dashboard` | Legacy dashboard loads |
| `#/sales` | API-backed sales workspace loads |
| `#/details/lead/{id}` | Lead detail opens from a real sales lead |
| `#/details/opportunity/{id}` | Opportunity detail opens from a real opportunity |
| `#/details/quote/{id}` | Quote detail opens from a real quote |
| `#/details/contract/{id}` | Contract detail opens from a real contract |
| `#/product-pricing` | Legacy product/pricing module loads |
| `#/customer-360` | Legacy customer 360 module loads |
| `#/billing` | Legacy billing module loads |
| `#/orders` | Legacy orders module loads |
| `#/reports` | Legacy reports module loads |
| `#/administration` | Legacy admin module loads |

For routes that still fall back to `App.jsx`, validate that they render and that any remaining mock-driven actions are clearly tracked in the PR notes.

## Backend Smoke Matrix

Use this matrix to avoid claiming full completion when only build checks have passed.

| Area | Smoke test |
| --- | --- |
| Service boot | `GET /health` returns 200 |
| Readiness | `GET /health/ready` returns healthy or a useful degraded payload |
| SQL sales storage | `GET /health/sales` returns 200 and counts |
| Pricing context | `GET /health/pricing-context` returns 200 in environments with the billing context table |
| Sales bootstrap | `GET /api/sales/bootstrap` returns dashboard, records, and reference data |
| Platform bootstrap | `GET /api/platform/bootstrap` returns cross-module portal data |
| Lead writes | Create lead, update lead, add activity, convert lead |
| Opportunity writes | Add/update/delete opportunity product, add note |
| Quote writes | Add/update/delete line item, price quote, submit approval |
| Approval writes | Approve, reject, request changes |
| Contract writes | Create/update contract, add/delete file metadata |
| Billing references | Customers, products, hierarchy, codes, elements, offers, promotions, and rate plans all return arrays |
| Ops writes | Create/update an order, create/update a provisioning job, create a network event |
| Admin writes | Create a user, role, and integration |
| Billing workflow writes | Create an invoice action and adjustment |

## What Is Not Yet Proven By Existing Code

The current backend exposes foundations for every major legacy UI domain, but live CI/staging validation is still required before claiming production completion. Do not wire modules to guessed URLs beyond the endpoint families listed in `docs/web-ui-module-migration-map.md`.

Known gaps before full mock removal:
- Customer-service ticket endpoints are still not a complete dedicated API family.
- Some endpoints are foundation-level and need permissions, audit trails, validation depth, and integration tests.
- Frontend modules still need loading, empty, error, and mutation states wired to the available APIs.
- Live Azure SQL and staging checks must pass against the deployed service.

Until those gaps are closed, keep affected modules either:
- explicitly mock-backed, or
- partially migrated to the existing `/api/billing/*` and `/api/sales/*` endpoints with remaining gaps called out in the PR.
