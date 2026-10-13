# Assistant Service

This service provides a dedicated backend contract for the `fc-gpt` in-app assistant experience.

## Endpoints

- `GET /health`
- `GET /api/assistant/ui-overrides`
- `POST /api/assistant/chat`
- `POST /api/assistant/change-requests/{id}/approve`
- `POST /api/assistant/change-requests/{id}/reject`
- `GET /api/assistant/github/branches`
- `GET /api/assistant/github/tree`
- `GET /api/assistant/github/file`

## Runtime modes

- Azure OpenAI / Azure AI Foundry responses API if configured
- Requests return a model response or an explicit error

## Local run

```bash
cd assistant-service
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

When running `web-ui` locally with `npm run dev`, Vite proxies `/api/*` to `http://127.0.0.1:8080` by default, so keep this service running on that port for assistant requests. `vite preview` and other static-serving modes do not use that proxy, so use the dev server when you want local API wiring to reflect immediately.

## Key environment variables

- `ASSISTANT_ALLOWED_ORIGINS`
- `ASSISTANT_ALLOWED_REPOSITORIES`
- `GITHUB_TOKEN`
- `AI_ASSISTANT_OFFLINE`
- `AI_AUTH_MODE`
- `AZURE_AI_FOUNDRY_DEPLOYMENT`
- `AZURE_AI_FOUNDRY_OPENAI_ENDPOINT`
- `AZURE_AI_FOUNDRY_PROJECT_ENDPOINT`
- `AZURE_AI_FOUNDRY_API_KEY`
- `AZURE_AI_FOUNDRY_SCOPE`
- `AZURE_AI_FOUNDRY_DEPLOYMENT`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
