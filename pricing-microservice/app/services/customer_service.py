from __future__ import annotations

import threading
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import get_sql_connection
from app.services import smoke_data
from app.services.ops import row_to_dict, stable_uuid, utc_now
from app.services.sales import ensure_sales_storage, fetch_all

router = APIRouter(prefix="/api/platform/customer-service", tags=["customer-service"])
CARE_READY = False
CARE_LOCK = threading.Lock()
SMOKE_TICKETS: list[dict[str, Any]] = []


def _normalize_customer(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "CustomerNumber": row.get("CustomerNumber") or row.get("id") or "CUST-UNKNOWN",
        "CustomerName": row.get("CustomerName") or row.get("Customer") or row.get("name") or row.get("AccountName") or "Unknown Customer",
        "Region": row.get("Region") or row.get("CustomerRegion") or "Unassigned",
        "Segment": row.get("Segment") or row.get("CustomerType") or "Unassigned",
        "SupportTier": row.get("SupportTier") or "Standard",
        "AccountManager": row.get("AccountManager") or row.get("PrimaryContact") or "Care Ops",
    }


def _build_tickets(customers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not customers:
        customers = [{"CustomerNumber": "CUST-1000", "CustomerName": "Customer", "Region": "Unassigned", "Segment": "Unassigned"}]
    rows: list[dict[str, Any]] = []
    categories = ["Network", "Billing", "Orders", "Care"]
    priorities = ["Urgent", "High", "Normal", "Normal"]
    for index, customer_row in enumerate(customers[:8]):
        customer = _normalize_customer(customer_row)
        category = categories[index % len(categories)]
        rows.append(
            {
                "TicketId": f"ticket-{index + 1}",
                "TicketNumber": f"TKT-{1001 + index}",
                "CustomerNumber": customer["CustomerNumber"],
                "AccountName": customer["CustomerName"],
                "IssueType": "Customer-reported outage" if category == "Network" else f"{category} inquiry",
                "Category": category,
                "Priority": priorities[index % len(priorities)],
                "Status": "Open" if index % 3 != 1 else "In Progress",
                "AgeHours": 18 + index * 6,
                "OwnerName": "Care Ops" if category != "Billing" else "Billing Ops",
                "Summary": f"{customer['CustomerName']} support request for {category.lower()} follow-up.",
                "Region": customer["Region"],
                "Segment": customer["Segment"],
                "SupportTier": customer["SupportTier"],
                "CreatedAtUtc": smoke_data.utc_now_iso(),
            }
        )
    return rows


def _build_outages(tickets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    outages = []
    for index, ticket in enumerate([row for row in tickets if row.get("Category") == "Network"]):
        outages.append(
            {
                "EventId": f"care-event-{index + 1}",
                "EventNumber": f"NE-{2001 + index}",
                "CustomerNumber": ticket.get("CustomerNumber"),
                "AccountName": ticket.get("AccountName"),
                "Market": ticket.get("Region") or "Unassigned",
                "Type": ticket.get("IssueType") or "Network issue",
                "Impacted": ticket.get("AccountName"),
                "Severity": ticket.get("Priority") or "High",
                "Status": ticket.get("Status") or "Open",
                "SlaExposure": 25000 + index * 5000,
                "CustomerReported": True,
            }
        )
    return outages


def _summary(tickets: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "openTicketCount": len([ticket for ticket in tickets if ticket.get("Status") != "Closed"]),
        "networkTicketCount": len([ticket for ticket in tickets if ticket.get("Category") == "Network"]),
        "billingTicketCount": len([ticket for ticket in tickets if ticket.get("Category") == "Billing"]),
        "averageAgeHours": round(sum(float(ticket.get("AgeHours") or 0) for ticket in tickets) / max(len(tickets), 1), 1),
    }


def _ticket_number(ticket_id: str) -> str:
    return f"TKT-{ticket_id[:4].upper()}"


def _smoke_tickets() -> list[dict[str, Any]]:
    global SMOKE_TICKETS
    if not SMOKE_TICKETS:
        SMOKE_TICKETS = _build_tickets(smoke_data.CUSTOMERS)
    return SMOKE_TICKETS


def _find_smoke_ticket(ticket_id: str) -> dict[str, Any] | None:
    return next((ticket for ticket in _smoke_tickets() if str(ticket.get("TicketId")) == str(ticket_id) or str(ticket.get("TicketNumber")) == str(ticket_id)), None)


def ensure_customer_service_storage() -> None:
    if smoke_data.smoke_mode_enabled():
        return
    global CARE_READY
    if CARE_READY:
        return
    with CARE_LOCK:
        if CARE_READY:
            return
        ddl = """
        IF SCHEMA_ID('care') IS NULL EXEC('CREATE SCHEMA care');
        IF OBJECT_ID('care.Tickets', 'U') IS NULL CREATE TABLE care.Tickets (
            TicketId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            TicketNumber NVARCHAR(32) NOT NULL,
            CustomerNumber NVARCHAR(32) NULL,
            AccountName NVARCHAR(200) NOT NULL,
            IssueType NVARCHAR(200) NOT NULL,
            Category NVARCHAR(100) NOT NULL,
            Priority NVARCHAR(50) NOT NULL,
            Status NVARCHAR(50) NOT NULL,
            OwnerName NVARCHAR(200) NULL,
            Summary NVARCHAR(MAX) NULL,
            CreatedBy NVARCHAR(200) NULL,
            CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAtUtc DATETIME2 NULL,
            IsDeleted BIT NOT NULL DEFAULT 0
        );
        IF OBJECT_ID('care.TicketNotes', 'U') IS NULL CREATE TABLE care.TicketNotes (
            TicketNoteId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            TicketId UNIQUEIDENTIFIER NOT NULL,
            NoteType NVARCHAR(100) NOT NULL,
            Note NVARCHAR(MAX) NOT NULL,
            CreatedBy NVARCHAR(200) NULL,
            CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
        """
        conn = get_sql_connection()
        try:
            conn.cursor().execute(ddl)
            conn.commit()
        finally:
            conn.close()
        seed_customer_service_data()
        CARE_READY = True


def _table_has_rows(table_name: str) -> bool:
    rows = _fetch_all(f"SELECT TOP 1 1 AS HasRow FROM {table_name}")
    return bool(rows)


def _fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        rows = cursor.execute(sql, params).fetchall()
        return [row_to_dict(cursor, row) for row in rows]
    finally:
        conn.close()


def _fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    rows = _fetch_all(sql, params)
    return rows[0] if rows else None


def _require_ticket(ticket_id: str) -> dict[str, Any]:
    ticket = _fetch_one("SELECT TOP 1 * FROM care.Tickets WHERE (TicketId = ? OR TicketNumber = ?) AND IsDeleted = 0", (ticket_id, ticket_id))
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket


def seed_customer_service_data() -> None:
    if _table_has_rows("care.Tickets"):
        return
    ensure_sales_storage()
    customers = fetch_all(
        """
        SELECT TOP 4 c.CustomerNumber, c.CustomerName, c.CustomerType, c.Region, c.Status,
               cp.Segment, cp.SupportTier, cp.AccountManager
        FROM billing.Customers c
        LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
        WHERE c.IsDeleted = 0
        ORDER BY c.CustomerName
        """
    )
    seed_rows = _build_tickets(customers)
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        for index, row in enumerate(seed_rows):
            ticket_id = stable_uuid(f"care-ticket-{index + 1}")
            cur.execute(
                "INSERT INTO care.Tickets (TicketId, TicketNumber, CustomerNumber, AccountName, IssueType, Category, Priority, Status, OwnerName, Summary, CreatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    ticket_id,
                    row["TicketNumber"],
                    row.get("CustomerNumber"),
                    row.get("AccountName") or "Customer",
                    row.get("IssueType") or "Customer inquiry",
                    row.get("Category") or "Care",
                    row.get("Priority") or "Normal",
                    row.get("Status") or "Open",
                    row.get("OwnerName") or "Care Ops",
                    row.get("Summary") or "Seed care ticket.",
                    "Seed",
                ),
            )
            cur.execute(
                "INSERT INTO care.TicketNotes (TicketNoteId, TicketId, NoteType, Note, CreatedBy) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), ticket_id, "Seed", "Initial seeded ticket context.", "Seed"),
            )
        conn.commit()
    finally:
        conn.close()


def list_tickets() -> list[dict[str, Any]]:
    if smoke_data.smoke_mode_enabled():
        return _smoke_tickets()
    ensure_customer_service_storage()
    return _fetch_all(
        """
        SELECT *, DATEDIFF(hour, CreatedAtUtc, SYSUTCDATETIME()) AS AgeHours
        FROM care.Tickets
        WHERE IsDeleted = 0
        ORDER BY CreatedAtUtc DESC
        """
    )


@router.get("/overview")
def customer_service_overview() -> dict[str, Any]:
    tickets = list_tickets()
    outages = _build_outages(tickets)
    return {
        "generatedAtUtc": smoke_data.utc_now_iso(),
        "tickets": tickets,
        "customerReportedOutages": outages,
        "summary": _summary(tickets),
    }


@router.get("/tickets")
def get_tickets() -> list[dict[str, Any]]:
    return list_tickets()


@router.post("/tickets")
def create_ticket(payload: dict[str, Any]) -> dict[str, Any]:
    ticket_id = str(uuid.uuid4())
    ticket = {
        "TicketId": ticket_id,
        "TicketNumber": payload.get("ticketNumber") or _ticket_number(ticket_id),
        "CustomerNumber": payload.get("customerNumber") or "Draft",
        "AccountName": payload.get("accountName") or payload.get("customerName") or "New Customer",
        "IssueType": payload.get("issueType") or "Customer inquiry",
        "Category": payload.get("category") or "Care",
        "Priority": payload.get("priority") or "Normal",
        "Status": payload.get("status") or "Open",
        "AgeHours": 0,
        "OwnerName": payload.get("ownerName") or "Care Ops",
        "Summary": payload.get("summary") or payload.get("notes") or "Customer service ticket created from the portal.",
        "CreatedBy": payload.get("createdBy") or "Care Ops",
        "CreatedAtUtc": smoke_data.utc_now_iso(),
    }
    if smoke_data.smoke_mode_enabled():
        _smoke_tickets().insert(0, ticket)
        return ticket
    ensure_customer_service_storage()
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO care.Tickets (TicketId, TicketNumber, CustomerNumber, AccountName, IssueType, Category, Priority, Status, OwnerName, Summary, CreatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                ticket_id,
                ticket["TicketNumber"],
                ticket["CustomerNumber"],
                ticket["AccountName"],
                ticket["IssueType"],
                ticket["Category"],
                ticket["Priority"],
                ticket["Status"],
                ticket["OwnerName"],
                ticket["Summary"],
                ticket["CreatedBy"],
            ),
        )
        cur.execute(
            "INSERT INTO care.TicketNotes (TicketNoteId, TicketId, NoteType, Note, CreatedBy) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), ticket_id, "Created", ticket["Summary"], ticket["CreatedBy"]),
        )
        conn.commit()
    finally:
        conn.close()
    return _require_ticket(ticket_id)


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str) -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        ticket = _find_smoke_ticket(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        return {"ticket": ticket, "notes": [{"NoteType": "Summary", "Note": ticket.get("Summary"), "CreatedBy": ticket.get("OwnerName")}]}
    ensure_customer_service_storage()
    ticket = _require_ticket(ticket_id)
    notes = _fetch_all("SELECT * FROM care.TicketNotes WHERE TicketId = ? ORDER BY CreatedAtUtc DESC", (ticket["TicketId"],))
    return {"ticket": ticket, "notes": notes}


@router.put("/tickets/{ticket_id}")
def update_ticket(ticket_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        ticket = _find_smoke_ticket(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        for source, target in (("status", "Status"), ("priority", "Priority"), ("ownerName", "OwnerName"), ("summary", "Summary")):
            if payload.get(source) is not None:
                ticket[target] = payload[source]
        return ticket
    ensure_customer_service_storage()
    current = _require_ticket(ticket_id)
    conn = get_sql_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE care.Tickets SET Status = ?, Priority = ?, OwnerName = ?, Summary = ?, UpdatedAtUtc = SYSUTCDATETIME() WHERE TicketId = ?",
            (
                payload.get("status", current.get("Status")),
                payload.get("priority", current.get("Priority")),
                payload.get("ownerName", current.get("OwnerName")),
                payload.get("summary", current.get("Summary")),
                current["TicketId"],
            ),
        )
        if payload.get("note"):
            cur.execute(
                "INSERT INTO care.TicketNotes (TicketNoteId, TicketId, NoteType, Note, CreatedBy) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), current["TicketId"], payload.get("noteType") or "Update", payload["note"], payload.get("createdBy") or "Care Ops"),
            )
        conn.commit()
    finally:
        conn.close()
    return _require_ticket(str(current["TicketId"]))
