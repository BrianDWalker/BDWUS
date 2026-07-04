import base64
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
    from openai import AzureOpenAI
except Exception:  # pragma: no cover
    AzureOpenAI = None


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



def heuristic_assistant_message(request: ChatRequest) -> tuple[str, list[dict[str, Any]]]:
    context = request.context or {}
    mode = request.mode
    message = request.message.strip()
    repo = context.get("githubRepo") or DEFAULT_ALLOWED_REPOSITORIES
    branch = context.get("githubBranch") or "fc-gpt"
    staged_files = context.get("githubFiles") or []
    page_title = context.get("pageTitle") or context.get("route") or "workspace"
    files_summary = summarize_files(staged_files)
    lower = message.lower()
    proposals: list[dict[str, Any]] = []

    if mode == "dev":
        proposals.append(
            {
                "kind": "github_update",
                "title": "Review staged repository changes",
                "target": f"{repo}@{branch}",
                "summary": "This proposal packages the currently staged files for manual review and a controlled GitHub commit workflow.",
                "patch": {
                    "github": {
                        "repository": repo,
                        "branch": branch,
                        "changeSummary": f"Review and refine {len(staged_files)} staged file(s) for the {page_title} workspace.",
                        "files": [
                            {
                                "filePath": item.get("path", "unknown"),
                                "content": item.get("content", ""),
                            }
                            for item in staged_files[:10]
                        ],
                    }
                },
            }
        )
        assistant_text = (
            f"I reviewed the repository context for **{page_title}** on `{repo}` / `{branch}`.\n\n"
            f"Attached files:\n{files_summary}\n\n"
            "I generated a controlled GitHub review proposal rather than writing directly, so the next step can stay approval-driven. "
            "To make this production-grade, the branch still needs diff generation, commit execution, and audit logging behind the approval path."
        )
        return assistant_text, proposals

    if mode == "agent":
        draft = context.get("salesDefaults") or {}
        proposals.append(
            {
                "kind": "lead_create",
                "title": "Create lead draft",
                "target": draft.get("accountName") or "New account",
                "summary": "Prepared a lead draft using the current assistant context and sales defaults.",
                "patch": {
                    "leadDraft": {
                        "accountName": draft.get("accountName", ""),
                        "contactName": draft.get("contactName", ""),
                        "productInterest": draft.get("productInterest", ""),
                        "ownerName": draft.get("ownerName", request.userName or "admin"),
                    }
                },
            }
        )
        return (
            "I prepared a lead-agent draft proposal from the supplied sales context. "
            "This service keeps the action approval-driven so the UI can review the payload before anything is written to a system of record.",
            proposals,
        )

    assistant_text = (
        f"I reviewed your request for the **{page_title}** workspace. "
        "This assistant service is wired to support grounded telecom knowledge, proposal generation, GitHub repository browsing, and approval-based actions. "
        "For deterministic local operation it uses repository/context-aware heuristics when a model is not configured."
    )

    if any(token in lower for token in ["quote", "pricing", "margin"]):
        assistant_text += " Pricing questions should also be cross-checked against the pricing microservice runtime before approval."
    elif any(token in lower for token in ["billing", "invoice", "charge"]):
        assistant_text += " Billing questions should be grounded in Azure SQL billing read models before any action is approved."
    elif any(token in lower for token in ["order", "provision", "activation"]):
        assistant_text += " Order and provisioning actions should remain workflow-gated until live orchestration endpoints are connected."

    return assistant_text, proposals



def model_assistant_message(request: ChatRequest) -> tuple[str, list[dict[str, Any]]]:
    if AzureOpenAI is None:
        return heuristic_assistant_message(request)

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
    if not endpoint or not api_key or not deployment:
        return heuristic_assistant_message(request)

    client = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version=api_version)
    system_prompt = (
        "You are the BDWUS telecom assistant. Ground answers in the provided context, be explicit about uncertainty, "
        "and prefer approval-based proposals over direct side effects."
    )
    user_payload = {
        "mode": request.mode,
        "message": request.message,
        "context": request.context,
        "userName": request.userName,
    }
    response = client.chat.completions.create(
        model=deployment,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(user_payload)},
        ],
    )
    text = response.choices[0].message.content if response.choices else "I am ready."
    heuristic_text, proposals = heuristic_assistant_message(request)
    return text or heuristic_text, proposals


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "service": APP_NAME,
        "status": "healthy",
        "time": utc_now(),
        "allowedRepositories": sorted(_allowed_repositories()),
        "assistantApiPrefix": API_PREFIX,
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
