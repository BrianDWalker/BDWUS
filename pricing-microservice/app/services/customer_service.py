from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.services import smoke_data
from app.services.sales import ensure_sales_storage, fetch_all

router = APIRouter(prefix="/api/platform/customer-service", tags=["customer-service"])


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


@router.get("/overview")
def customer_service_overview() -> dict[str, Any]:
    if smoke_data.smoke_mode_enabled():
        customers = smoke_data.CUSTOMERS
    else:
        ensure_sales_storage()
        customers = fetch_all(
            """
            SELECT TOP 25 c.CustomerNumber, c.CustomerName, c.CustomerType, c.Region, c.Status,
                   cp.Segment, cp.SupportTier, cp.AccountManager
            FROM billing.Customers c
            LEFT JOIN billing.CustomerProfiles cp ON cp.CustomerNumber = c.CustomerNumber AND cp.IsDeleted = 0
            WHERE c.IsDeleted = 0
            ORDER BY c.CustomerName
            """
        )
    tickets = _build_tickets(customers)
    outages = _build_outages(tickets)
    return {
        "generatedAtUtc": smoke_data.utc_now_iso(),
        "tickets": tickets,
        "customerReportedOutages": outages,
        "summary": _summary(tickets),
    }
