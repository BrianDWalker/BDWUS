import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider
    from openai import OpenAI
except Exception:  # pragma: no cover
    DefaultAzureCredential = None
    get_bearer_token_provider = None
    OpenAI = None


APP_NAME = "BDWUS Assistant Service"
API_PREFIX = "/api/assistant"
DEFAULT_ALLOWED_REPOSITORIES = "BrianDWalker/BDWUS"
DEFAULT_GITHUB_API_BASE = "https://api.github.com"
SYSTEM_OVERRIDES = {
    "knowledge": [],
    "sales": [],
    "product-pricing": [],
    "billing": [],
}
CHANGE_REQUESTS: dict[str, dict[str, Any]] = {}
AI_MODEL = (
    os.getenv("AZURE_AI_FOUNDRY_DEPLOYMENT")
    or os.getenv("AZURE_OPENAI_DEPLOYMENT")
    or "gpt-5-nano"
)
AI_ENDPOINT = (
    os.getenv("AZURE_AI_FOUNDRY_OPENAI_ENDPOINT")
    or os.getenv("AZURE_OPENAI_ENDPOINT")
    or ""
).rstrip("/")
AI_PROJECT_ENDPOINT = os.getenv("AZURE_AI_FOUNDRY_PROJECT_ENDPOINT", "").rstrip("/")
AI_API_KEY = os.getenv("AZURE_AI_FOUNDRY_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
AI_AUTH_MODE = os.getenv("AI_AUTH_MODE", "auto").lower()
AI_SCOPE = os.getenv("AZURE_AI_FOUNDRY_SCOPE", "https://ai.azure.com/.default")
AI_OFFLINE = os.getenv("AI_ASSISTANT_OFFLINE", "false").lower() in {"1", "true", "yes"}


class ChatRequest(BaseModel):
    conversationId: str | None = None
    mode: str = "knowledge"
    message: str = Field(..., min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)
    userName: str | None = "admin"


class ApprovalRequest(BaseModel):
    approvedBy: str | None = "admin"


app = FastAPI(title=APP_NAME, version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ASSISTANT_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _allowed_repositories() -> set[str]:
    return {
        item.strip()
        for item in os.getenv("ASSISTANT_ALLOWED_REPOSITORIES", DEFAULT_ALLOWED_REPOSITORIES).split(",")
        if item.strip()
    }


def ensure_allowed_repository(repository: str) -> None:
    if repository not in _allowed_repositories():
        raise HTTPException(status_code=403, detail=f"Repository '{repository}' is not allow-listed.")



def github_headers() -> dict[str, str]:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "bdwus-assistant-service/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers



def github_api_get(path: str, params: dict[str, Any] | None = None) -> Any:
    response = requests.get(
        f"{os.getenv('GITHUB_API_BASE', DEFAULT_GITHUB_API_BASE)}{path}",
        headers=github_headers(),
        params=params or {},
        timeout=20,
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=response.text or "GitHub request failed.")
    return response.json()



def github_contents(repository: str, path: str = "", ref: str | None = None) -> Any:
    owner, repo = repository.split("/", 1)
    params = {"ref": ref} if ref else None
    return github_api_get(f"/repos/{owner}/{repo}/contents/{path}", params=params)



def summarize_files(files: list[dict[str, Any]]) -> str:
    if not files:
        return "No staged files were attached."
    lines = []
    for item in files[:5]:
        path = item.get("path", "unknown")
        content = str(item.get("content", ""))
        preview = " ".join(content.strip().splitlines()[:2]).strip()[:140] or "No preview available"
        lines.append(f"- `{path}`: {preview}")
    return "\n".join(lines)


def normalize_openai_base_url(endpoint: str) -> str:
    cleaned = endpoint.rstrip("/")
    if not cleaned:
        return ""
    if cleaned.endswith("/openai/v1"):
        return cleaned
    if "/api/projects/" in cleaned:
        origin = cleaned.split("/api/projects/", 1)[0].rstrip("/")
        return f"{origin}/openai/v1"
    return f"{cleaned}/openai/v1"


def model_status() -> dict[str, Any]:
    base_url = normalize_openai_base_url(AI_ENDPOINT or AI_PROJECT_ENDPOINT)
    configured = bool(base_url and (AI_API_KEY or AI_AUTH_MODE in {"bearer_token", "managed_identity", "entra"}))
    return {
        "configured": configured,
        "endpoint": base_url,
        "deployment": AI_MODEL,
        "authMode": AI_AUTH_MODE,
        "offline": AI_OFFLINE,
    }


def openai_client() -> OpenAI | None:
    if AI_OFFLINE or OpenAI is None:
        return None

    base_url = normalize_openai_base_url(AI_ENDPOINT or AI_PROJECT_ENDPOINT)
    if not base_url:
        return None

    if AI_AUTH_MODE == "api_key":
        return OpenAI(api_key=AI_API_KEY, base_url=base_url) if AI_API_KEY else None

    if AI_AUTH_MODE in {"bearer_token", "managed_identity", "entra"}:
        if DefaultAzureCredential is None or get_bearer_token_provider is None:
            return None
        token_provider = get_bearer_token_provider(
            DefaultAzureCredential(exclude_interactive_browser_credential=False),
            AI_SCOPE,
        )
        return OpenAI(api_key=token_provider, base_url=base_url)

    if AI_API_KEY:
        return OpenAI(api_key=AI_API_KEY, base_url=base_url)

    if DefaultAzureCredential is None or get_bearer_token_provider is None:
        return None
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(exclude_interactive_browser_credential=False),
        AI_SCOPE,
    )
    return OpenAI(api_key=token_provider, base_url=base_url)


def extract_response_text(response: Any) -> str:
    text = getattr(response, "output_text", "")
    if isinstance(text, str) and text.strip():
        return text.strip()
    output = getattr(response, "output", []) or []
    parts: list[str] = []
    for item in output:
        content = getattr(item, "content", None) if not isinstance(item, dict) else item.get("content")
        if not content:
            continue
        for entry in content:
            value = getattr(entry, "text", None) if not isinstance(entry, dict) else entry.get("text")
            if isinstance(value, str) and value.strip():
                parts.append(value.strip())
    return "\n".join(parts).strip()



def model_assistant_message(request: ChatRequest) -> tuple[str, list[dict[str, Any]]]:
    client = openai_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Assistant model is not configured. Set Azure AI Foundry or Azure OpenAI endpoint, deployment, and credentials.",
        )

    system_prompt = (
        "You are the BDWUS telecom assistant. Keep answers concise, conversational, and directly useful. "
        "Ground answers in the provided context and be explicit about uncertainty."
    )
    user_payload = {
        "mode": request.mode,
        "message": request.message,
        "context": request.context,
        "userName": request.userName,
    }
    try:
        response = client.responses.create(
            model=AI_MODEL,
            instructions=system_prompt,
            input=str(user_payload),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Assistant model request failed: {exc}") from exc

    text = extract_response_text(response)
    if not text:
        raise HTTPException(status_code=502, detail="Assistant model returned an empty response.")
    return text, []


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "service": APP_NAME,
        "status": "healthy",
        "time": utc_now(),
        "allowedRepositories": sorted(_allowed_repositories()),
        "assistantApiPrefix": API_PREFIX,
        "model": model_status(),
    }


@app.get(f"{API_PREFIX}/ui-overrides")
def ui_overrides(scope: str = Query(default="knowledge")) -> list[dict[str, Any]]:
    return SYSTEM_OVERRIDES.get(scope, [])


@app.post(f"{API_PREFIX}/chat")
def chat(request: ChatRequest) -> dict[str, Any]:
    conversation_id = request.conversationId or f"conv-{uuid.uuid4()}"
    assistant_message, proposals = model_assistant_message(request)
    change_request_ids: list[str] = []
    for proposal in proposals:
        change_request_id = proposal.get("changeRequestId") or f"cr-{uuid.uuid4()}"
        proposal["changeRequestId"] = change_request_id
        CHANGE_REQUESTS[change_request_id] = {
            "changeRequestId": change_request_id,
            "status": "pending",
            "proposal": proposal,
            "requestedBy": request.userName,
            "requestedAt": utc_now(),
        }
        change_request_ids.append(change_request_id)
    return {
        "conversationId": conversation_id,
        "assistantMessage": assistant_message,
        "proposals": proposals,
        "changeRequestIds": change_request_ids,
    }


@app.post(f"{API_PREFIX}/change-requests/{{change_request_id}}/approve")
def approve_change_request(change_request_id: str, request: ApprovalRequest) -> dict[str, Any]:
    item = CHANGE_REQUESTS.get(change_request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Change request not found.")
    item["status"] = "approved"
    item["approvedBy"] = request.approvedBy
    item["approvedAt"] = utc_now()
    return item


@app.post(f"{API_PREFIX}/change-requests/{{change_request_id}}/reject")
def reject_change_request(change_request_id: str, request: ApprovalRequest) -> dict[str, Any]:
    item = CHANGE_REQUESTS.get(change_request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Change request not found.")
    item["status"] = "rejected"
    item["approvedBy"] = request.approvedBy
    item["approvedAt"] = utc_now()
    return item


@app.get(f"{API_PREFIX}/github/branches")
def get_github_branches(repository: str = Query(...)) -> dict[str, Any]:
    ensure_allowed_repository(repository)
    owner, repo = repository.split("/", 1)
    branches = github_api_get(f"/repos/{owner}/{repo}/branches", params={"per_page": 100})
    return {
        "repository": repository,
        "branches": [
            {
                "name": item.get("name"),
                "sha": item.get("commit", {}).get("sha"),
                "protected": bool(item.get("protected", False)),
            }
            for item in branches
        ],
    }


@app.get(f"{API_PREFIX}/github/tree")
def get_github_tree(
    repository: str = Query(...),
    branch: str = Query(...),
    path: str = Query(default=""),
) -> dict[str, Any]:
    ensure_allowed_repository(repository)
    payload = github_contents(repository, path=path, ref=branch)
    entries = payload if isinstance(payload, list) else [payload]
    normalized = []
    for entry in entries:
        normalized.append(
            {
                "name": entry.get("name"),
                "path": entry.get("path"),
                "type": "dir" if entry.get("type") == "dir" else "file",
                "sha": entry.get("sha"),
                "size": entry.get("size", 0),
            }
        )
    normalized.sort(key=lambda item: (item["type"] != "dir", item["name"] or ""))
    return {"repository": repository, "branch": branch, "path": path, "entries": normalized}


@app.get(f"{API_PREFIX}/github/file")
def get_github_file(
    repository: str = Query(...),
    branch: str = Query(...),
    path: str = Query(...),
) -> dict[str, Any]:
    ensure_allowed_repository(repository)
    payload = github_contents(repository, path=path, ref=branch)
    if payload.get("type") != "file":
        raise HTTPException(status_code=400, detail="Requested path is not a file.")
    content = payload.get("content", "")
    encoding = payload.get("encoding", "base64")
    if encoding == "base64":
        decoded = base64.b64decode(content).decode("utf-8")
    else:
        decoded = content
    return {
        "repository": repository,
        "branch": branch,
        "path": path,
        "sha": payload.get("sha"),
        "size": payload.get("size", 0),
        "content": decoded,
    }
