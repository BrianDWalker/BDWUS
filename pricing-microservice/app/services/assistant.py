import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

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


AI_SCHEMA = os.getenv("AI_SCHEMA", "ai")
AI_MODEL = os.getenv("AZURE_OPENAI_DEPLOYMENT", "bdwus-ai")
AI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AI_OFFLINE = os.getenv("AI_ASSISTANT_OFFLINE", "false").lower() in {"1", "true", "yes"}

MAX_HISTORY_MESSAGES = int(os.getenv("AI_ASSISTANT_MAX_HISTORY_MESSAGES", "8"))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def openai_client() -> OpenAI | None:
    if AI_OFFLINE or not AI_ENDPOINT or not AI_API_KEY:
        return None
    return OpenAI(api_key=AI_API_KEY, base_url=f"{AI_ENDPOINT}/openai/v1/")


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
      "kind": "ui_override|ui_patch|note",
      "patch": { "overrides": [ { "targetKey": "...", "value": "..." } ] },
      "requiresApproval": true
    }
  ]
}

Rules:
- In dev mode, propose changes instead of claiming anything was changed.
- All UI edits require approval before they are applied.
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
    needs_change = request.mode == "dev" or any(word in message.lower() for word in ["change", "rename", "move", "add", "remove", "update", "edit", "build"])
    proposals: list[dict[str, Any]] = []
    if needs_change:
      page_requested = any(word in message.lower() for word in ["page", "screen", "tab", "route"])
      patch_overrides: list[dict[str, Any]] = [
          {
              "targetKey": "knowledge.pageHeader.askAiLabel",
              "value": "Ask AI"
          }
      ]
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


def call_model(request: AssistantChatRequest, history: list[dict[str, Any]]) -> dict[str, Any]:
    client = openai_client()
    if client is None:
      return offline_response(request, history)

    prompt = build_prompt(request, history)
    response = client.responses.create(
        model=AI_MODEL,
        input=prompt,
        max_output_tokens=700,
    )
    text = getattr(response, "output_text", None) or ""
    if not text:
      raw = response.model_dump()
      text = json.dumps(raw.get("output", []))
    payload = extract_json_object(text)
    if "assistantMessage" not in payload:
      payload["assistantMessage"] = text.strip()
    payload.setdefault("proposals", [])
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
