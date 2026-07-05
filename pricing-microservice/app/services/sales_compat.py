from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.sales import (
    ensure_sales_storage,
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
            # Let the migrated UI continue to work for new/unmatched leads while preserving the supplied customer number.
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


@router.post("/opportunities")
def create_opportunity_compat(payload: dict[str, Any]):
    """Compatibility path for the migrated Sales UI.

    The UI can open the New Opportunity dialog from a header button where a user may not know a raw
    AccountId. This keeps that existing action functional by resolving an account from customer/name data
    or creating a lightweight placeholder account instead of returning a hard 400.
    """
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
    """Convert leads even when a newly created lead has no matched billing customer yet."""
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
    """Preserve activity logging from the migrated UI instead of saving it as a generic note."""
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

    from app.services.sales import fetch_all

    return fetch_all("SELECT * FROM ms.OpportunityNotes WHERE OpportunityId = ? AND IsDeleted = 0 ORDER BY CreatedAtUtc DESC", (str(opportunity_id),))
