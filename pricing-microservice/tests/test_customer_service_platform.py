import pytest
from fastapi import HTTPException

from app.main import app
from app.services import customer_service


def test_customer_service_router_registered():
    routes = {(getattr(route, "path", None), tuple(sorted(getattr(route, "methods", [])))) for route in app.routes}
    assert any(path == "/api/platform/customer-service/overview" and "GET" in methods for path, methods in routes)
    assert any(path == "/api/platform/customer-service/tickets" and "POST" in methods for path, methods in routes)
    assert any(path == "/api/platform/customer-service/tickets/{ticket_id}" and "GET" in methods for path, methods in routes)
    assert any(path == "/api/platform/customer-service/tickets/{ticket_id}" and "PUT" in methods for path, methods in routes)
    assert any(path == "/api/platform/customer-service/tickets/{ticket_id}/notes" and "POST" in methods for path, methods in routes)


def test_customer_service_summary_counts():
    tickets = [
        {"Category": "Network", "Status": "Open", "AgeHours": 10, "EscalationLevel": "Tier 2"},
        {"Category": "Billing", "Status": "In Progress", "AgeHours": 20, "EscalationLevel": "Tier 1"},
        {"Category": "Care", "Status": "Closed", "AgeHours": 30, "EscalationLevel": "Tier 1"},
    ]
    summary = customer_service._summary(tickets)
    assert summary["openTicketCount"] == 2
    assert summary["networkTicketCount"] == 1
    assert summary["billingTicketCount"] == 1
    assert summary["averageAgeHours"] == 20
    assert summary["escalatedTicketCount"] == 1


def test_smoke_ticket_create_detail_update_and_comment(monkeypatch):
    monkeypatch.setattr(customer_service.smoke_data, "smoke_mode_enabled", lambda: True)
    customer_service.SMOKE_TICKETS = []

    created = customer_service.create_ticket({"accountName": "Apex Health", "issueType": "Billing question", "category": "Billing", "priority": "High", "slaTargetHours": 12})
    assert created["TicketNumber"].startswith("TKT-")
    assert created["AccountName"] == "Apex Health"
    assert created["Status"] == "Open"
    assert created["SlaTargetHours"] == 12

    detail = customer_service.get_ticket(created["TicketId"])
    assert detail["ticket"]["TicketId"] == created["TicketId"]
    assert detail["notes"]

    note = customer_service.add_ticket_note(created["TicketId"], {"note": "Customer called back.", "noteType": "Comment", "createdBy": "Care Ops"})
    assert note["NoteType"] == "Comment"
    assert note["Note"] == "Customer called back."

    updated = customer_service.update_ticket(created["TicketId"], {"status": "Closed", "ownerName": "Care Lead", "escalationLevel": "Tier 2", "closureReason": "Resolved", "slaTargetHours": 4})
    assert updated["Status"] == "Closed"
    assert updated["OwnerName"] == "Care Lead"
    assert updated["EscalationLevel"] == "Tier 2"
    assert updated["ClosureReason"] == "Resolved"
    assert updated["SlaTargetHours"] == 4
    assert updated["ClosedAtUtc"]


def test_ticket_note_requires_note(monkeypatch):
    monkeypatch.setattr(customer_service.smoke_data, "smoke_mode_enabled", lambda: True)
    customer_service.SMOKE_TICKETS = []
    created = customer_service.create_ticket({"accountName": "Apex Health"})
    with pytest.raises(HTTPException) as exc_info:
        customer_service.add_ticket_note(created["TicketId"], {})
    assert exc_info.value.status_code == 400


def test_smoke_ticket_detail_not_found(monkeypatch):
    monkeypatch.setattr(customer_service.smoke_data, "smoke_mode_enabled", lambda: True)
    customer_service.SMOKE_TICKETS = []
    with pytest.raises(HTTPException) as exc_info:
        customer_service.get_ticket("missing-ticket")
    assert exc_info.value.status_code == 404
