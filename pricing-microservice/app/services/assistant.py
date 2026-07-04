import json
import os
import re
import uuid
import base64
from datetime import datetime, timezone
from typing import Any
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import OpenAI

from app.database import get_sql_connection
from app.models import (
    AssistantApprovalRequest,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantChangeRequest,
    AssistantContext,
    AssistantProposal,
    AssistantUiOverride,
)
from app.services.sales import create_lead as create_sales_lead, ensure_sales_storage


AI_SCHEMA = os.getenv("AI_SCHEMA", "ai")
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
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_API_URL = os.getenv("GITHUB_API_URL", "https://api.github.com").rstrip("/")

MAX_HISTORY_MESSAGES = int(os.getenv("AI_ASSISTANT_MAX_HISTORY_MESSAGES", "8"))


def normalize_github_repository(repository: str) -> str:
    cleaned = (repository or "").strip().strip("/")
    parts = [item for item in cleaned.split("/") if item]
    if len(parts) != 2:
        raise ValueError("GitHub repository must be formatted as owner/repo.")
    return "/".join(parts)


def normalize_github_branch(branch: str) -> str:
    cleaned = (branch or "").strip()
    if not cleaned:
        raise ValueError("GitHub branch is required.")
    return cleaned


def normalize_github_path(path: str) -> str:
    cleaned = (path or "").strip().strip("/")
    return cleaned


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def openai_client() -> OpenAI | None:
    if AI_OFFLINE:
        return None

    base_url = normalize_openai_base_url(AI_ENDPOINT or AI_PROJECT_ENDPOINT)
    if not base_url:
        return None

    if AI_AUTH_MODE == "api_key":
        return OpenAI(api_key=AI_API_KEY, base_url=base_url) if AI_API_KEY else None

    if AI_AUTH_MODE in {"bearer_token", "managed_identity", "entra"}:
        token_provider = get_bearer_token_provider(
            DefaultAzureCredential(exclude_interactive_browser_credential=False),
            AI_SCOPE,
        )
        return OpenAI(api_key=token_provider, base_url=base_url)

    if AI_API_KEY:
        return OpenAI(api_key=AI_API_KEY, base_url=base_url)

    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(exclude_interactive_browser_credential=False),
        AI_SCOPE,
    )
    return OpenAI(api_key=token_provider, base_url=base_url)


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
    raise ValueError("Assistant response did not contain valid JSON.")


def extract_text_from_output_items(items: list[Any]) -> str:
    parts: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if isinstance(item.get("text"), str):
            parts.append(item["text"])
        content = item.get("content")
        if isinstance(content, list):
            for entry in content:
                if not isinstance(entry, dict):
                    continue
                text_value = entry.get("text")
                if isinstance(text_value, str):
                    parts.append(text_value)
    return "\n".join(part for part in parts if part).strip()


def safe_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def ensure_ai_storage() -> None:
    ddl = f"""
    IF SCHEMA_ID('{AI_SCHEMA}') IS NULL EXEC('CREATE SCHEMA {AI_SCHEMA}');

    IF OBJECT_ID('{AI_SCHEMA}.Conversations', 'U') IS NULL
    BEGIN
      CREATE TABLE {AI_SCHEMA}.Conversations (
        ConversationId NVARCHAR(64) NOT NULL PRIMARY KEY,
        Mode NVARCHAR(32) NOT NULL,
        Page NVARCHAR(64) NOT NULL,
        CreatedBy NVARCHAR(128) NULL,
        CreatedAtUtc DATETIME2 NOT NULL,
        LastMessageAtUtc DATETIME2 NULL
      );
    END;

    IF OBJECT_ID('{AI_SCHEMA}.Messages', 'U') IS NULL
    BEGIN
      CREATE TABLE {AI_SCHEMA}.Messages (
        MessageId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId NVARCHAR(64) NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
      CREATE INDEX IX_{AI_SCHEMA}_Messages_ConversationId ON {AI_SCHEMA}.Messages (ConversationId, CreatedAtUtc);
    END;

    IF OBJECT_ID('{AI_SCHEMA}.ChangeRequests', 'U') IS NULL
    BEGIN
      CREATE TABLE {AI_SCHEMA}.ChangeRequests (
        ChangeRequestId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId NVARCHAR(64) NOT NULL,
        RequestedBy NVARCHAR(128) NULL,
        Mode NVARCHAR(32) NOT NULL,
        Page NVARCHAR(64) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Summary NVARCHAR(MAX) NOT NULL,
        Target NVARCHAR(200) NOT NULL,
        Kind NVARCHAR(50) NOT NULL,
        PatchJson NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL,
        ApprovedAtUtc DATETIME2 NULL,
        ApprovedBy NVARCHAR(128) NULL,
        AppliedAtUtc DATETIME2 NULL,
        AppliedBy NVARCHAR(128) NULL
      );
      CREATE INDEX IX_{AI_SCHEMA}_ChangeRequests_Status ON {AI_SCHEMA}.ChangeRequests (Status, CreatedAtUtc DESC);
    END;

    IF OBJECT_ID('{AI_SCHEMA}.UiOverrides', 'U') IS NULL
    BEGIN
      CREATE TABLE {AI_SCHEMA}.UiOverrides (
        OverrideId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ChangeRequestId UNIQUEIDENTIFIER NOT NULL,
        Scope NVARCHAR(64) NOT NULL,
        TargetKey NVARCHAR(200) NOT NULL,
        ValueJson NVARCHAR(MAX) NOT NULL,
        Active BIT NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
      CREATE INDEX IX_{AI_SCHEMA}_UiOverrides_Scope ON {AI_SCHEMA}.UiOverrides (Scope, Active, CreatedAtUtc DESC);
    END;

    IF OBJECT_ID('{AI_SCHEMA}.AuditLog', 'U') IS NULL
    BEGIN
      CREATE TABLE {AI_SCHEMA}.AuditLog (
        AuditId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventType NVARCHAR(100) NOT NULL,
        EntityType NVARCHAR(100) NOT NULL,
        EntityId NVARCHAR(100) NOT NULL,
        DetailsJson NVARCHAR(MAX) NULL,
        CreatedAtUtc DATETIME2 NOT NULL
      );
    END;
    """
    conn = get_sql_connection()
    try:
      conn.cursor().execute(ddl)
      conn.commit()
    finally:
      conn.close()


def log_audit(event_type: str, entity_type: str, entity_id: str, details: dict[str, Any] | None = None) -> None:
    conn = get_sql_connection()
    try:
      conn.cursor().execute(
          f"""
          INSERT INTO {AI_SCHEMA}.AuditLog (AuditId, EventType, EntityType, EntityId, DetailsJson, CreatedAtUtc)
          VALUES (?, ?, ?, ?, ?, ?)
          """,
          uuid.uuid4(),
          event_type,
          entity_type,
          entity_id,
          safe_json(details or {}),
          utc_now(),
      )
      conn.commit()
    finally:
      conn.close()


def get_recent_messages(conversation_id: str) -> list[dict[str, Any]]:
    conn = get_sql_connection()
    try:
      rows = conn.cursor().execute(
          f"""
          SELECT TOP (?) Role, Content, MetadataJson, CreatedAtUtc
          FROM {AI_SCHEMA}.Messages
          WHERE ConversationId = ?
          ORDER BY CreatedAtUtc DESC
          """,
          MAX_HISTORY_MESSAGES,
          conversation_id,
      ).fetchall()
      ordered = list(reversed(rows))
      return [
          {
              "role": row.Role,
              "content": row.Content,
              "metadata": json.loads(row.MetadataJson) if row.MetadataJson else {},
              "createdAtUtc": row.CreatedAtUtc.isoformat() if row.CreatedAtUtc else None,
          }
          for row in ordered
      ]
    finally:
      conn.close()


def store_message(conversation_id: str, role: str, content: str, metadata: dict[str, Any] | None = None) -> None:
    conn = get_sql_connection()
    try:
      conn.cursor().execute(
          f"""
          INSERT INTO {AI_SCHEMA}.Messages (MessageId, ConversationId, Role, Content, MetadataJson, CreatedAtUtc)
          VALUES (?, ?, ?, ?, ?, ?)
          """,
          uuid.uuid4(),
          conversation_id,
          role,
          content,
          safe_json(metadata or {}),
          utc_now(),
      )
      conn.cursor().execute(
          f"""
          MERGE {AI_SCHEMA}.Conversations AS target
          USING (SELECT ? AS ConversationId) AS source
          ON target.ConversationId = source.ConversationId
          WHEN MATCHED THEN
            UPDATE SET LastMessageAtUtc = ?
          WHEN NOT MATCHED THEN
            INSERT (ConversationId, Mode, Page, CreatedAtUtc, LastMessageAtUtc)
            VALUES (?, ?, ?, ?, ?);
          """,
          conversation_id,
          utc_now(),
          conversation_id,
          metadata.get("mode", "knowledge") if metadata else "knowledge",
          metadata.get("page", "knowledge") if metadata else "knowledge",
          utc_now(),
          utc_now(),
      )
      conn.commit()
    finally:
      conn.close()


def build_prompt(request: AssistantChatRequest, history: list[dict[str, Any]]) -> str:
    instructions = """
You are the BDWUS in-app assistant.
You must return JSON only with this shape:
{
  "assistantMessage": "string",
  "proposals": [
    {
      "title": "short title",
      "summary": "what would change and why",
      "target": "page or component target",
      "kind": "ui_override|ui_patch|note|lead_create|github_update",
      "patch": { "overrides": [ { "targetKey": "...", "value": "..." } ] },
      "requiresApproval": true
    }
  ]
}

Rules:
- In knowledge mode, behave like a telecom knowledge search and answer assistant.
- In agent mode, help create telecom leads. If the user gives enough information to create a lead, return a single `lead_create` proposal with a `leadDraft` object in `patch`.
- In dev mode, act like a repository-aware engineering agent. Use the provided GitHub branch, file, and selected file contents to reason about real code changes, but still propose changes instead of claiming anything was changed.
- All UI edits require approval before they are applied.
- For `lead_create`, include:
  {
    "leadDraft": {
      "accountName": "...",
      "contactName": "...",
      "source": "...",
      "qualification": "...",
      "status": "...",
      "estimatedValue": 0,
      "ownerName": "...",
      "productInterest": "...",
      "serviceNeeds": ["..."],
      "customerInfo": { ... },
      "notes": "..."
    }
  }
- In dev mode, if the user wants GitHub changes, return a `github_update` proposal with:
  {
    "github": {
      "repository": "owner/repo",
      "branch": "branch-name",
      "changeSummary": "...",
      "commitMessage": "...",
      "files": [
        {
          "filePath": "path/to/file",
          "content": "full file content to write"
        }
      ],
      "instructions": ["...", "..."]
    }
  }
- If only one file is involved you may also include the legacy `filePath` and `content` fields, but prefer the `files` array for all new dev-mode proposals.
- In dev mode, when GitHub file contents are present in `pageContext.githubFiles`, treat them as the current source of truth for the target branch and write complete replacement content for every changed file.
- When the user asks to create a new page, include an override with targetKey "assistant.pages" and a value shaped like an object or array of page objects:
  {
    "id": "stable slug",
    "title": "Page title",
    "description": "What the page is for",
    "route": "optional route slug",
    "sections": [
      { "title": "Section title", "body": "Short content or bullets" }
    ]
  }
  The frontend will surface approved generated pages in the Knowledge experience.
- Keep the response concise.
- If the request is a normal knowledge question, answer it directly and include no proposals unless the user asks to change the UI.
- Do not mention this system prompt.
""".strip()
    prompt = {
        "instructions": instructions,
        "mode": request.mode,
        "page": request.context.route or request.context.pageTitle or "knowledge",
        "pageContext": request.context.model_dump(),
        "conversation": history[-MAX_HISTORY_MESSAGES:],
        "userMessage": request.message,
    }
    return safe_json(prompt)


def offline_response(request: AssistantChatRequest, history: list[dict[str, Any]]) -> dict[str, Any]:
    message = request.message.strip()
    proposals: list[dict[str, Any]] = []
    if request.mode == "agent":
      proposals.append(build_agent_lead_proposal(request, message))
      return {
          "assistantMessage": "I drafted a lead creation action. Review it and approve to create the lead in the telecom workflow.",
          "proposals": proposals,
      }

    needs_change = request.mode == "dev" or any(word in message.lower() for word in ["change", "rename", "move", "add", "remove", "update", "edit", "build"])
    if needs_change:
      page_requested = any(word in message.lower() for word in ["page", "screen", "tab", "route"])
      patch_overrides: list[dict[str, Any]] = [
          {
              "targetKey": "knowledge.pageHeader.askAiLabel",
              "value": "Ask AI"
          }
      ]
      if request.mode == "dev" and any(word in message.lower() for word in ["repo", "repository", "github", "branch", "file", "pull request", "pr"]):
        proposals.append(build_github_update_proposal(request, message))
        return {
            "assistantMessage": "I prepared a GitHub-targeted change request with repository, branch, and file details for review.",
            "proposals": proposals,
        }
      if page_requested:
        slug = re.sub(r"[^a-z0-9]+", "-", message.lower()).strip("-") or "test-page"
        patch_overrides.append({
            "targetKey": "assistant.pages",
            "value": [
                {
                    "id": slug[:48],
                    "title": "Test Page",
                    "description": "Generated by the in-app assistant after approval.",
                    "route": slug[:48],
                    "sections": [
                        {
                            "title": "Overview",
                            "body": "This page was created from an approved AI proposal."
                        }
                    ]
                }
            ]
        })
      proposals.append({
          "title": "Propose UI update",
          "summary": "Review the requested UI change and apply it after confirmation.",
          "target": request.context.route or "knowledge",
          "kind": "ui_override",
          "patch": {
              "overrides": patch_overrides
          },
          "requiresApproval": True,
      })
    return {
        "assistantMessage": f"Offline assistant draft for: {message}",
        "proposals": proposals,
    }


def build_agent_lead_proposal(request: AssistantChatRequest, message: str) -> dict[str, Any]:
    sales_defaults = request.context.salesDefaults or {}
    lead_draft = {
        "accountName": sales_defaults.get("accountName") or "New Telecom Account",
        "contactName": sales_defaults.get("contactName") or "Primary Contact",
        "source": sales_defaults.get("source") or "AI Agent",
        "qualification": "Open",
        "status": "Open",
        "estimatedValue": sales_defaults.get("estimatedValue") or 0,
        "ownerName": sales_defaults.get("ownerName") or request.userName or "AI Agent",
        "productInterest": sales_defaults.get("productInterest") or "Fiber 500",
        "serviceNeeds": sales_defaults.get("serviceNeeds") or ["Fiber 500"],
        "customerInfo": sales_defaults.get("customerInfo") or {"createdBy": "ai-agent"},
        "notes": f"Drafted from assistant request: {message}",
    }
    return {
        "title": "Create telecom lead",
        "summary": "Review and create a new lead directly in the telecom workflow.",
        "target": "sales/leads",
        "kind": "lead_create",
        "patch": {"leadDraft": lead_draft},
        "requiresApproval": True,
    }


def build_github_update_proposal(request: AssistantChatRequest, message: str) -> dict[str, Any]:
    selected_files = []
    for item in request.context.githubFiles:
        file_path = normalize_github_path(str(item.get("path") or item.get("filePath") or ""))
        if not file_path:
            continue
        selected_files.append({
            "filePath": file_path,
            "content": f"// Replace with approved content for {file_path}\n",
        })
    if not selected_files:
        fallback_path = request.context.githubFilePath or "path/to/file"
        selected_files.append({
            "filePath": fallback_path,
            "content": "// Replace with approved file content\n",
        })
    return {
        "title": "Prepare GitHub change request",
        "summary": "Review a repository-targeted development change for one or more files on a specific branch.",
        "target": request.context.githubRepo or "GitHub repository",
        "kind": "github_update",
        "patch": {
            "github": {
                "repository": request.context.githubRepo or "owner/repo",
                "branch": request.context.githubBranch or "feature/ai-change",
                "changeSummary": message,
                "commitMessage": "Apply approved AI change request",
                "files": selected_files,
                "instructions": [
                    "Review the selected repository context and target branch.",
                    "Apply the approved file changes exactly as specified.",
                    "Validate the updated files before committing them."
                ],
            }
        },
        "requiresApproval": True,
    }


def is_github_commit_question(request: AssistantChatRequest) -> bool:
    message = request.message.lower()
    return (
        request.mode == "dev"
        and bool(request.context.githubRepo)
        and any(word in message for word in ["commit", "commits", "history", "recent changes", "latest change"])
    )


def github_commit_answer(request: AssistantChatRequest) -> dict[str, Any]:
    branch = request.context.githubBranch or "fc-gpt"
    try:
      result = get_github_commits(request.context.githubRepo or "", branch, 5)
    except ValueError as exc:
      return {
          "assistantMessage": f"I tried to check GitHub commits for `{request.context.githubRepo}` on `{branch}`, but GitHub returned an error: {exc}",
          "proposals": [],
      }
    commits = result.get("commits") or []
    if not commits:
        return {
            "assistantMessage": f"I checked `{result['repository']}` on `{result['branch']}`, but GitHub did not return any commits.",
            "proposals": [],
        }
    latest = commits[0]
    lines = [
        f"The most recent commit on `{result['repository']}` branch `{result['branch']}` is:",
        "",
        f"- `{latest.get('shortSha')}` {latest.get('message')}",
        f"- Author: {latest.get('author')}",
        f"- Date: {latest.get('date')}",
    ]
    if latest.get("htmlUrl"):
        lines.append(f"- GitHub: {latest.get('htmlUrl')}")
    if len(commits) > 1:
        lines.extend(["", "Recent commits:"])
        for commit in commits[1:]:
            lines.append(f"- `{commit.get('shortSha')}` {commit.get('message')} ({commit.get('author')}, {commit.get('date')})")
    return {
        "assistantMessage": "\n".join(lines),
        "proposals": [],
    }


def call_model(request: AssistantChatRequest, history: list[dict[str, Any]]) -> dict[str, Any]:
    if is_github_commit_question(request):
      return github_commit_answer(request)

    client = openai_client()
    if client is None:
      return offline_response(request, history)

    prompt = build_prompt(request, history)
    response = client.responses.create(
        model=AI_MODEL,
        input=prompt,
        max_output_tokens=1600,
    )
    text = getattr(response, "output_text", None) or ""
    raw = response.model_dump()
    if not text:
      text = extract_text_from_output_items(raw.get("output", []))
    if not text:
      text = json.dumps(raw.get("output", []))
    payload_raw = extract_json_object(text)
    payload = payload_raw if isinstance(payload_raw, dict) else {}
    if "assistantMessage" not in payload and isinstance(payload_raw, dict):
      payload["assistantMessage"] = text.strip()
    payload.setdefault("proposals", [])
    if request.mode == "agent" and not any(item.get("kind") == "lead_create" for item in payload["proposals"]):
      payload["proposals"] = [build_agent_lead_proposal(request, request.message)]
      payload["assistantMessage"] = payload.get("assistantMessage") or "I drafted a lead creation action for review."
    has_github_targets = bool(request.context.githubFilePath or request.context.githubFiles)
    if request.mode == "dev" and request.context.githubRepo and has_github_targets and not any(item.get("kind") == "github_update" for item in payload["proposals"]):
      payload["proposals"].append(build_github_update_proposal(request, request.message))
      payload["assistantMessage"] = payload.get("assistantMessage") or "I prepared a GitHub-targeted change request for review."
    payload["assistantMessage"] = payload.get("assistantMessage") or "I am ready."
    return payload


def create_change_request(
    conversation_id: str,
    request: AssistantChatRequest,
    proposal: AssistantProposal,
) -> uuid.UUID:
    change_request_id = uuid.uuid4()
    conn = get_sql_connection()
    try:
      conn.cursor().execute(
          f"""
          INSERT INTO {AI_SCHEMA}.ChangeRequests
          (ChangeRequestId, ConversationId, RequestedBy, Mode, Page, Title, Summary, Target, Kind, PatchJson, Status, CreatedAtUtc)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          change_request_id,
          conversation_id,
          request.userName,
          request.mode,
          request.context.route or request.context.pageTitle or "knowledge",
          proposal.title,
          proposal.summary,
          proposal.target,
          proposal.kind,
          safe_json(proposal.patch),
          "Proposed",
          utc_now(),
      )
      conn.commit()
    finally:
      conn.close()
    log_audit("change_request_proposed", "change_request", str(change_request_id), {
        "conversationId": conversation_id,
        "proposal": proposal.model_dump(),
    })
    return change_request_id


def github_api_path(path: str, params: dict[str, str] | None = None) -> str:
    if not params:
        return path
    return f"{path}?{urlparse.urlencode(params)}"


def github_request(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    if not GITHUB_TOKEN:
      raise ValueError("GitHub execution is not configured. Add GITHUB_TOKEN to enable repository updates.")
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(
        f"{GITHUB_API_URL}{path}",
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
      with urlrequest.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}
    except urlerror.HTTPError as exc:
      detail = exc.read().decode("utf-8", errors="replace")
      raise ValueError(f"GitHub API error ({exc.code}): {detail}") from exc


def get_github_branches(repository: str) -> dict[str, Any]:
    normalized_repo = normalize_github_repository(repository)
    payload = github_request("GET", github_api_path(f"/repos/{normalized_repo}/branches", {"per_page": "100"}))
    branches = []
    for item in payload if isinstance(payload, list) else []:
        branches.append({
            "name": item.get("name"),
            "sha": ((item.get("commit") or {}).get("sha")),
            "protected": bool(item.get("protected")),
        })
    return {
        "repository": normalized_repo,
        "branches": branches,
    }


def get_github_tree(repository: str, branch: str, path: str = "") -> dict[str, Any]:
    normalized_repo = normalize_github_repository(repository)
    normalized_branch = normalize_github_branch(branch)
    normalized_path = normalize_github_path(path)
    encoded_path = urlparse.quote(normalized_path, safe="/")
    response = github_request(
        "GET",
        github_api_path(f"/repos/{normalized_repo}/contents/{encoded_path}", {"ref": normalized_branch}) if encoded_path
        else github_api_path(f"/repos/{normalized_repo}/contents", {"ref": normalized_branch}),
    )
    if not isinstance(response, list):
        raise ValueError("The selected GitHub path is a file. Use the file reader for file contents.")
    entries = [
        {
            "name": item.get("name"),
            "path": item.get("path"),
            "type": item.get("type"),
            "sha": item.get("sha"),
            "size": item.get("size") or 0,
        }
        for item in response
        if isinstance(item, dict)
    ]
    entries.sort(key=lambda item: (item.get("type") != "dir", (item.get("path") or "").lower()))
    return {
        "repository": normalized_repo,
        "branch": normalized_branch,
        "path": normalized_path,
        "entries": entries,
    }


def get_github_file(repository: str, branch: str, path: str) -> dict[str, Any]:
    normalized_repo = normalize_github_repository(repository)
    normalized_branch = normalize_github_branch(branch)
    normalized_path = normalize_github_path(path)
    if not normalized_path:
        raise ValueError("GitHub file path is required.")
    encoded_path = urlparse.quote(normalized_path, safe="/")
    response = github_request(
        "GET",
        github_api_path(f"/repos/{normalized_repo}/contents/{encoded_path}", {"ref": normalized_branch}),
    )
    if not isinstance(response, dict) or response.get("type") != "file":
        raise ValueError("The selected GitHub path is not a file.")
    encoded_content = response.get("content") or ""
    content = ""
    if response.get("encoding") == "base64" and encoded_content:
        content = base64.b64decode(encoded_content.encode("utf-8")).decode("utf-8", errors="replace")
    return {
        "repository": normalized_repo,
        "branch": normalized_branch,
        "path": normalized_path,
        "name": response.get("name"),
        "sha": response.get("sha"),
        "size": response.get("size") or len(content),
        "content": content,
    }


def get_github_commits(repository: str, branch: str, limit: int = 5) -> dict[str, Any]:
    normalized_repo = normalize_github_repository(repository)
    normalized_branch = normalize_github_branch(branch)
    per_page = max(1, min(limit, 20))
    payload = github_request(
        "GET",
        github_api_path(
            f"/repos/{normalized_repo}/commits",
            {"sha": normalized_branch, "per_page": str(per_page)},
        ),
    )
    commits = []
    for item in payload if isinstance(payload, list) else []:
        commit = item.get("commit") or {}
        author = commit.get("author") or {}
        commits.append({
            "sha": item.get("sha"),
            "shortSha": str(item.get("sha") or "")[:7],
            "message": (commit.get("message") or "").splitlines()[0],
            "author": author.get("name") or ((item.get("author") or {}).get("login")) or "Unknown",
            "date": author.get("date"),
            "htmlUrl": item.get("html_url"),
        })
    return {
        "repository": normalized_repo,
        "branch": normalized_branch,
        "commits": commits,
    }


def normalize_github_files_patch(github: dict[str, Any]) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    raw_files = github.get("files")
    if isinstance(raw_files, list):
        for item in raw_files:
            if not isinstance(item, dict):
                continue
            file_path = normalize_github_path(str(item.get("filePath") or item.get("path") or ""))
            content = item.get("content")
            if not file_path or not isinstance(content, str):
                continue
            files.append({
                "filePath": file_path,
                "content": content,
            })
    legacy_path = normalize_github_path(str(github.get("filePath") or ""))
    legacy_content = github.get("content")
    if legacy_path and isinstance(legacy_content, str) and not any(item["filePath"] == legacy_path for item in files):
        files.append({
            "filePath": legacy_path,
            "content": legacy_content,
        })
    if not files:
        raise ValueError("GitHub change request is missing at least one file with full content.")
    deduped: dict[str, str] = {}
    for item in files:
        deduped[item["filePath"]] = item["content"]
    return [
        {"filePath": file_path, "content": content}
        for file_path, content in deduped.items()
    ]


def execute_github_update(record: AssistantChangeRequest) -> dict[str, Any]:
    github = record.patch.get("github") or {}
    repository = normalize_github_repository(str(github.get("repository") or ""))
    branch = normalize_github_branch(str(github.get("branch") or ""))
    commit_message = github.get("commitMessage") or record.title
    files = normalize_github_files_patch(github)

    ref = github_request("GET", f"/repos/{repository}/git/ref/heads/{urlparse.quote(branch, safe='/')}")
    head_commit_sha = ((ref.get("object") or {}).get("sha"))
    if not head_commit_sha:
      raise ValueError("Unable to resolve the current GitHub branch head.")
    head_commit = github_request("GET", f"/repos/{repository}/git/commits/{head_commit_sha}")
    base_tree_sha = ((head_commit.get("tree") or {}).get("sha"))
    if not base_tree_sha:
      raise ValueError("Unable to resolve the current GitHub branch tree.")

    tree_entries = []
    for item in files:
        blob = github_request(
            "POST",
            f"/repos/{repository}/git/blobs",
            {
                "content": item["content"],
                "encoding": "utf-8",
            },
        )
        blob_sha = blob.get("sha")
        if not blob_sha:
            raise ValueError(f"GitHub blob creation failed for {item['filePath']}.")
        tree_entries.append({
            "path": item["filePath"],
            "mode": "100644",
            "type": "blob",
            "sha": blob_sha,
        })

    tree = github_request(
        "POST",
        f"/repos/{repository}/git/trees",
        {
            "base_tree": base_tree_sha,
            "tree": tree_entries,
        },
    )
    tree_sha = tree.get("sha")
    if not tree_sha:
        raise ValueError("GitHub tree creation failed.")
    commit = github_request(
        "POST",
        f"/repos/{repository}/git/commits",
        {
            "message": commit_message,
            "tree": tree_sha,
            "parents": [head_commit_sha],
        },
    )
    commit_sha = commit.get("sha")
    if not commit_sha:
        raise ValueError("GitHub commit creation failed.")
    github_request(
        "PATCH",
        f"/repos/{repository}/git/refs/heads/{urlparse.quote(branch, safe='/')}",
        {
            "sha": commit_sha,
            "force": False,
        },
    )
    log_audit("github_change_applied", "change_request", str(record.changeRequestId), {
        "repository": repository,
        "branch": branch,
        "filePaths": [item["filePath"] for item in files],
        "commitSha": commit_sha,
    })
    return {
        "repository": repository,
        "branch": branch,
        "commitSha": commit_sha,
        "fileCount": len(files),
        "files": files,
    }


def execute_lead_create(record: AssistantChangeRequest) -> dict[str, Any]:
    ensure_sales_storage()
    lead_draft = record.patch.get("leadDraft")
    if not isinstance(lead_draft, dict):
      raise ValueError("Lead creation request is missing a leadDraft payload.")
    created = create_sales_lead(lead_draft)
    log_audit("lead_created_from_assistant", "change_request", str(record.changeRequestId), {
        "leadId": created.get("LeadId"),
        "leadNumber": created.get("LeadNumber"),
    })
    return created


def chat(request: AssistantChatRequest) -> AssistantChatResponse:
    ensure_ai_storage()
    conversation_id = request.conversationId or str(uuid.uuid4())
    history = get_recent_messages(conversation_id)
    store_message(conversation_id, "user", request.message, {
        "mode": request.mode,
        "page": request.context.route or request.context.pageTitle or "knowledge",
    })
    payload = call_model(request, history)
    assistant_message = payload.get("assistantMessage", "").strip() or "I am ready."
    proposals_payload = payload.get("proposals") or []
    proposals: list[AssistantProposal] = []
    change_request_ids: list[uuid.UUID] = []
    for raw_proposal in proposals_payload:
      proposal = AssistantProposal.model_validate(raw_proposal)
      proposals.append(proposal)
      change_request_ids.append(create_change_request(conversation_id, request, proposal))
    store_message(conversation_id, "assistant", assistant_message, {
        "mode": request.mode,
        "proposalCount": len(proposals),
        "changeRequestIds": [str(item) for item in change_request_ids],
    })
    return AssistantChatResponse(
        conversationId=conversation_id,
        assistantMessage=assistant_message,
        mode=request.mode,
        proposals=proposals,
        changeRequestIds=change_request_ids,
    )


def list_ui_overrides(scope: str) -> list[AssistantUiOverride]:
    ensure_ai_storage()
    conn = get_sql_connection()
    try:
      rows = conn.cursor().execute(
          f"""
          SELECT Scope, TargetKey, ValueJson, ChangeRequestId, CreatedAtUtc
          FROM {AI_SCHEMA}.UiOverrides
          WHERE Scope = ? AND Active = 1
          ORDER BY CreatedAtUtc DESC
          """,
          scope,
      ).fetchall()
      return [
          AssistantUiOverride(
              scope=row.Scope,
              targetKey=row.TargetKey,
              value=json.loads(row.ValueJson),
              sourceChangeRequestId=row.ChangeRequestId,
              createdAtUtc=row.CreatedAtUtc,
          )
          for row in rows
      ]
    finally:
      conn.close()


def get_change_request(change_request_id: uuid.UUID) -> AssistantChangeRequest | None:
    ensure_ai_storage()
    conn = get_sql_connection()
    try:
      row = conn.cursor().execute(
          f"""
          SELECT ChangeRequestId, ConversationId, Mode, Page, Title, Summary, Target, Kind, PatchJson, Status, CreatedAtUtc, ApprovedAtUtc, AppliedAtUtc, ApprovedBy, AppliedBy
          FROM {AI_SCHEMA}.ChangeRequests
          WHERE ChangeRequestId = ?
          """,
          change_request_id,
      ).fetchone()
      if not row:
        return None
      return AssistantChangeRequest(
          changeRequestId=row.ChangeRequestId,
          conversationId=row.ConversationId,
          mode=row.Mode,
          page=row.Page,
          title=row.Title,
          summary=row.Summary,
          target=row.Target,
          kind=row.Kind,
          patch=json.loads(row.PatchJson),
          status=row.Status,
          createdAtUtc=row.CreatedAtUtc,
          approvedAtUtc=row.ApprovedAtUtc,
          appliedAtUtc=row.AppliedAtUtc,
          approvedBy=row.ApprovedBy,
          appliedBy=row.AppliedBy,
      )
    finally:
      conn.close()


def approve_change_request(change_request_id: uuid.UUID, request: AssistantApprovalRequest) -> AssistantChangeRequest:
    ensure_ai_storage()
    record = get_change_request(change_request_id)
    if record is None:
      raise ValueError("Change request not found.")

    if record.kind == "lead_create":
      execute_lead_create(record)
    elif record.kind == "github_update":
      execute_github_update(record)

    conn = get_sql_connection()
    try:
      approved_at = utc_now()
      conn.cursor().execute(
          f"""
          UPDATE {AI_SCHEMA}.ChangeRequests
          SET Status = ?, ApprovedAtUtc = ?, ApprovedBy = ?, AppliedAtUtc = ?, AppliedBy = ?
          WHERE ChangeRequestId = ?
          """,
          "Approved",
          approved_at,
          request.approvedBy,
          approved_at,
          request.approvedBy,
          change_request_id,
      )
      if record.kind in {"ui_override", "ui_patch"}:
        overrides = record.patch.get("overrides", [])
        for override in overrides:
          conn.cursor().execute(
              f"""
              INSERT INTO {AI_SCHEMA}.UiOverrides
              (OverrideId, ChangeRequestId, Scope, TargetKey, ValueJson, Active, CreatedAtUtc)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              """,
              uuid.uuid4(),
              change_request_id,
              record.page,
              override["targetKey"],
              safe_json(override["value"]),
              1,
              approved_at,
          )
      conn.commit()
    finally:
      conn.close()
    log_audit("change_request_approved", "change_request", str(change_request_id), {
        "approvedBy": request.approvedBy,
        "overrides": record.patch.get("overrides", []),
    })
    updated = get_change_request(change_request_id)
    if updated is None:
      raise ValueError("Change request missing after approval.")
    return updated


def reject_change_request(change_request_id: uuid.UUID, rejected_by: str = "admin") -> AssistantChangeRequest:
    ensure_ai_storage()
    record = get_change_request(change_request_id)
    if record is None:
      raise ValueError("Change request not found.")
    conn = get_sql_connection()
    try:
      rejected_at = utc_now()
      conn.cursor().execute(
          f"""
          UPDATE {AI_SCHEMA}.ChangeRequests
          SET Status = ?, ApprovedBy = ?, ApprovedAtUtc = ?, AppliedAtUtc = ?, AppliedBy = ?
          WHERE ChangeRequestId = ?
          """,
          "Rejected",
          rejected_by,
          None,
          None,
          None,
          change_request_id,
      )
      conn.commit()
    finally:
      conn.close()
    log_audit("change_request_rejected", "change_request", str(change_request_id), {
        "rejectedBy": rejected_by,
    })
    updated = get_change_request(change_request_id)
    if updated is None:
      raise ValueError("Change request missing after rejection.")
    return updated
