from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.ops import ensure_ops_storage, execute as ops_execute, require_row as ops_require_row
from app.services.sales import (
    ensure_sales_storage,
    fetch_all,
    fetch_one,
    get_sql_connection,
    get_view_row,
    invalidate_bootstrap_cache,
    trim,
    upsert_account_from_customer,
)

router = APIRouter(prefix="/api/sales", tags=["sales-compat"])


def _create_placeholder_account(account_name: str | None = None, customer_number: str | None = None) -> str:
    account_id = str(uuid.uuid4())
    display_name = trim(account_name) or "New Account"
    conn = get_sql_connection()
    try:
        conn.cursor().execute(
            """
            INSERT INTO ms.Accounts
            (AccountId, AccountNumber, CustomerNumber, AccountName, Segment, Region, Status, OwnerName, Mrr, CustomerInfoJson)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                account_id,
                f"ACCT-{account_id[:4].upper()}",
                trim(customer_number),
                display_name,
                "Unassigned",
                "Unassigned",
                "Active",
                "Admin",
                0,
                "{}",
            ),
        )
        conn.commit()
        invalidate_bootstrap_cache()
    finally:
        conn.close()
    return account_id


def _resolve_account_id(payload: dict[str, Any], account_name: str | None = None) -> str:
    account_id = trim(payload.get("accountId") or payload.get("AccountId"))
    if account_id:
        return account_id

    customer_number = trim(payload.get("customerNumber") or payload.get("CustomerNumber"))
    if customer_number:
        try:
            return upsert_account_from_customer(customer_number, account_name or trim(payload.get("accountName") or payload.get("AccountName")))
        except HTTPException:
            return _create_placeholder_account(account_name or trim(payload.get("accountName") or payload.get("AccountName")), customer_number)

    resolved_name = trim(account_name or payload.get("accountName") or payload.get("AccountName") or payload.get("opportunityName"))
    if resolved_name:
        existing = fetch_one(
            "SELECT TOP 1 AccountId FROM ms.Accounts WHERE AccountName = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC",
            (resolved_name,),
        )
        if existing:
            return existing["AccountId"]

    existing = fetch_one("SELECT TOP 1 AccountId FROM ms.Accounts WHERE IsDeleted = 0 ORDER BY CreatedAtUtc DESC")
    if existing:
        return existing["AccountId"]

    return _create_placeholder_account(resolved_name)


def _first_quote_line_summary(quote_id: str) -> dict[str, Any]:
    line = fetch_one(
        """
        SELECT TOP 1 ProductName, ServiceName, BillingCode, Quantity, Mrc, Nrc
        FROM ms.QuoteLineItems
        WHERE QuoteId = ? AND IsDeleted = 0
        ORDER BY CreatedAtUtc
        """,
        (quote_id,),
    )
    return line or {}


def _quote_order_payload(quote_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    quote = get_view_row("ms.vQuoteDetail", "QuoteId", quote_id)
    opportunity = get_view_row("ms.vOpportunityDetail", "OpportunityId", quote["OpportunityId"])
    line = _first_quote_line_summary(quote_id)
    account_name = trim(payload.get("accountName") or quote.get("AccountName") or opportunity.get("AccountNameResolved") or opportunity.get("OpportunityName")) or "New Account"
    service_name = trim(payload.get("serviceName") or line.get("ServiceName") or line.get("ProductName") or opportunity.get("ProductSummary")) or "Service"
    order_number = trim(payload.get("orderNumber")) or f"ORD-{str(uuid.uuid4())[:4].upper()}"
    return {
        "orderNumber": order_number,
        "customerNumber": trim(payload.get("customerNumber") or opportunity.get("CustomerNumber")),
        "accountName": account_name,
        "serviceName": service_name,
        "lifecycleStage": trim(payload.get("lifecycleStage")) or "Design",
        "overallStatus": trim(payload.get("overallStatus")) or "Draft",
        "slaStatus": trim(payload.get("slaStatus")) or "On Track",
        "dueDate": payload.get("dueDate"),
        "assignedTeam": trim(payload.get("assignedTeam")) or "Provisioning Ops",
        "circuitId": trim(payload.get("circuitId")) or f"QUOTE-{str(quote.get('QuoteNumber') or quote_id)[:18]}",
        "location": trim(payload.get("location")) or trim(opportunity.get("ServiceSummary")) or "Primary site",
        "sourceQuoteId": quote_id,
        "sourceQuoteNumber": quote.get("QuoteNumber"),
        "sourceOpportunityId": quote.get("OpportunityId"),
        "quoteApprovalStatus": quote.get("ApprovalStatus"),
    }


@router.post("/opportunities")
def create_opportunity_compat(payload: dict[str, Any]):
    ensure_sales_storage()
    account_id = _resolve_account_id(payload)
    opportunity_id = str(uuid.uuid4())
    conn = get_sql_connection()
    try:
        conn.cursor().execute(
            """
            INSERT INTO ms.Opportunities
            (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                opportunity_id,
                trim(payload.get("opportunityNumber")) or f"OPP-{opportunity_id[:4].upper()}",
                payload.get("leadId"),
                account_id,
                trim(payload.get("opportunityName")) or "New Opportunity",
                trim(payload.get("stage")) or "Discovery",
                trim(payload.get("status")) or "Open",
                trim(payload.get("ownerName")) or trim(payload.get("owner")) or "Admin",
                payload.get("closeDate"),
                payload.get("estimatedValue") or 0,
                payload.get("marginPct"),
                payload.get("locationCount"),
                trim(payload.get("productSummary") or payload.get("productInterest")),
                trim(payload.get("serviceSummary")),
                trim(payload.get("approvalStatus")) or "Draft",
                payload.get("convertedFromLeadId"),
            ),
        )
        conn.commit()
        invalidate_bootstrap_cache()
    finally:
        conn.close()
    return get_view_row("ms.vOpportunityDetail", "OpportunityId", opportunity_id)


@router.post("/leads/{lead_id}/convert")
def convert_lead_compat(lead_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    lead = fetch_one("SELECT TOP 1 * FROM ms.Leads WHERE LeadId = ? AND IsDeleted = 0", (str(lead_id),))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    account_id = _resolve_account_id(payload, lead.get("AccountName"))
    opportunity_id = str(uuid.uuid4())
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO ms.Opportunities
            (OpportunityId, OpportunityNumber, LeadId, AccountId, OpportunityName, Stage, Status, OwnerName, CloseDate, EstimatedValue, MarginPct, LocationCount, ProductSummary, ServiceSummary, ApprovalStatus, ConvertedFromLeadId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                opportunity_id,
                payload.get("opportunityNumber") or f"OPP-{opportunity_id[:4].upper()}",
                str(lead_id),
                account_id,
                trim(payload.get("opportunityName")) or f"{lead.get('AccountName') or 'Lead'} opportunity",
                "Qualification",
                "Open",
                trim(payload.get("ownerName")) or lead.get("OwnerName") or "Admin",
                payload.get("closeDate"),
                payload.get("estimatedValue") or lead.get("EstimatedValue") or 0,
                payload.get("marginPct"),
                payload.get("locationCount"),
                lead.get("ProductInterest"),
                lead.get("ServiceNeedsJson") or "[]",
                "Open",
                str(lead_id),
            ),
        )
        cur.execute(
            """
            UPDATE ms.Leads
            SET Status = ?, Qualification = ?, ConvertedOpportunityId = ?, UpdatedAtUtc = SYSUTCDATETIME()
            WHERE LeadId = ?
            """,
            ("Converted", "Open", opportunity_id, str(lead_id)),
        )
        cur.execute(
            """
            INSERT INTO ms.OpportunityNotes
            (OpportunityNoteId, OpportunityId, NoteType, Note, CreatedBy)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                opportunity_id,
                "Conversion",
                f"Lead converted from {lead.get('LeadNumber') or lead_id}.",
                trim(payload.get("approvedBy")) or lead.get("OwnerName") or "Admin",
            ),
        )
        conn.commit()
        invalidate_bootstrap_cache()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return get_view_row("ms.vOpportunityDetail", "OpportunityId", opportunity_id)


@router.post("/opportunities/{opportunity_id}/notes")
def create_opportunity_note_compat(opportunity_id: uuid.UUID, payload: dict[str, Any]):
    ensure_sales_storage()
    has_activity_fields = any(payload.get(key) for key in ("activityDate", "activityType", "outcome", "nextStep"))
    note_type = trim(payload.get("noteType")) or ("Activity" if has_activity_fields else "General")
    note = trim(payload.get("note") or payload.get("notes")) or ""
    if has_activity_fields:
        parts = [
            trim(payload.get("activityType")),
            trim(payload.get("outcome")),
            note,
            trim(payload.get("nextStep")),
        ]
        note = " | ".join(part for part in parts if part)

    conn = get_sql_connection()
    try:
        conn.cursor().execute(
            """
            INSERT INTO ms.OpportunityNotes
            (OpportunityNoteId, OpportunityId, NoteType, Note, CreatedBy)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                str(opportunity_id),
                note_type,
                note,
                trim(payload.get("createdBy")) or "Admin",
            ),
        )
        conn.commit()
        invalidate_bootstrap_cache()
    finally:
        conn.close()

    return fetch_all("SELECT * FROM ms.OpportunityNotes WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (str(opportunity_id),))


@router.post("/quotes/{quote_id}/convert-to-order")
def convert_quote_to_order(quote_id: uuid.UUID, payload: dict[str, Any] | None = None):
    ensure_sales_storage()
    ensure_ops_storage()
    quote = get_view_row("ms.vQuoteDetail", "QuoteId", str(quote_id))
    if str(quote.get("ApprovalStatus") or "").lower() not in {"approved", "ready"}:
        raise HTTPException(status_code=400, detail="Quote must be approved before creating an order.")
    order_payload = _quote_order_payload(str(quote_id), payload or {})
    order_id = str(uuid.uuid4())
    ops_execute(
        "INSERT INTO ops.Orders (OrderId, OrderNumber, CustomerNumber, AccountName, ServiceName, LifecycleStage, OverallStatus, SlaStatus, DueDate, AssignedTeam, CircuitId, Location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            order_id,
            order_payload["orderNumber"],
            order_payload["customerNumber"],
            order_payload["accountName"],
            order_payload["serviceName"],
            order_payload["lifecycleStage"],
            order_payload["overallStatus"],
            order_payload["slaStatus"],
            order_payload["dueDate"],
            order_payload["assignedTeam"],
            order_payload["circuitId"],
            order_payload["location"],
        ),
    )
    order = ops_require_row("SELECT TOP 1 * FROM ops.Orders WHERE OrderId = ?", (order_id,))
    return {
        "order": order,
        "source": {
            "QuoteId": str(quote_id),
            "QuoteNumber": order_payload["sourceQuoteNumber"],
            "OpportunityId": order_payload["sourceOpportunityId"],
            "ApprovalStatus": order_payload["quoteApprovalStatus"],
        },
    }
