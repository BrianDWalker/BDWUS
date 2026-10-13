# fc-gpt Implementation Status

## What was added in this branch update

### New service scaffold
- `assistant-service/`
  - FastAPI service contract for the in-app assistant
  - Health endpoint
  - Assistant chat endpoint
  - UI override endpoint
  - Approval endpoints
  - GitHub branch/tree/file read endpoints
  - Optional Azure OpenAI / Azure AI Foundry runtime support with heuristic fallback

### Existing platform API hardening
- `pricing-microservice/app/main.py`
  - CORS now reads from `ALLOWED_ORIGINS`
  - Root endpoint now reports platform modules
  - Added `/health/ready` for SQL, assistant storage, sales storage, and pricing context readiness
  - Version and service metadata are environment-driven

### Web UI integration improvement
- `web-ui/src/utils/assistantApi.js`
  - Removed hardcoded production-only assistant base URL default
  - API base is now environment-driven with same-origin fallback
  - Error handling now surfaces backend detail more clearly

### CI / delivery foundations
- `.github/workflows/platform-build-validation.yml`
- `.github/workflows/assistant-service-containerapp.yml`
- `.github/workflows/pricing-microservice-containerapp.yml`

## Environment variables

### Web UI
- `VITE_AI_API_BASE_URL`

### Pricing microservice
- `ALLOWED_ORIGINS`
- `PLATFORM_API_SERVICE_NAME`
- `PLATFORM_API_VERSION`
- Existing Azure SQL / Azure OpenAI / GitHub variables remain in use

### Assistant service
- `ASSISTANT_ALLOWED_ORIGINS`
- `ASSISTANT_ALLOWED_REPOSITORIES`
- `GITHUB_TOKEN`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

## Remaining work after this commit

This update lays down the service contract, deployment structure, and health/config hardening. The portal still needs additional phased work to fully replace mock-data-backed business modules with service-backed implementations for:

- Product & pricing governance
- Billing account and invoice operations
- Orders and provisioning orchestration
- Network/service operational queues
- Reporting execution
- Administration and RBAC

## Recommended next implementation sequence

1. Replace Product & Pricing mock data with persistent read/write APIs.
2. Replace Billing and Customer 360 mock data with Azure SQL-backed aggregations.
3. Replace Orders module mock data with stateful order orchestration.
4. Expand assistant proposal execution to cover controlled domain mutations.
5. Add automated tests for assistant endpoints and platform API readiness.
