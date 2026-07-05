import uuid

import pytest
from fastapi import HTTPException

from app.main import app
from app.services import sales_compat
from tests.route_helpers import iter_effective_routes


def test_quote_to_order_route_registered_before_sales_router():
    matches = [
        route for route in iter_effective_routes(app.routes)
        if getattr(route, "path", None) == "/api/sales/quotes/{quote_id}/convert-to-order"
        and "POST" in getattr(route, "methods", set())
    ]
    assert matches
    assert matches[0].endpoint.__name__ == "convert_quote_to_order"


def test_quote_order_payload_derives_context(monkeypatch):
    quote_id = str(uuid.uuid4())
    opportunity_id = str(uuid.uuid4())

    def fake_get_view_row(view_name, key_name, value):
        if view_name == "ms.vQuoteDetail":
            return {
                "QuoteId": quote_id,
                "QuoteNumber": "Q-1001",
                "OpportunityId": opportunity_id,
                "AccountName": "Apex Health",
                "ApprovalStatus": "Approved",
            }
        if view_name == "ms.vOpportunityDetail":
            return {
                "OpportunityId": opportunity_id,
                "OpportunityName": "Apex expansion",
                "AccountNameResolved": "Apex Health",
                "CustomerNumber": "CUST-1001",
                "ProductSummary": "Fiber 1G",
                "ServiceSummary": "Primary campus",
            }
        raise AssertionError(view_name)

    monkeypatch.setattr(sales_compat, "get_view_row", fake_get_view_row)
    monkeypatch.setattr(sales_compat, "_first_quote_line_summary", lambda _quote_id: {"ProductName": "Fiber 1G", "Mrc": 1200})

    payload = sales_compat._quote_order_payload(quote_id, {})

    assert payload["customerNumber"] == "CUST-1001"
    assert payload["accountName"] == "Apex Health"
    assert payload["serviceName"] == "Fiber 1G"
    assert payload["lifecycleStage"] == "Design"
    assert payload["overallStatus"] == "Draft"
    assert payload["assignedTeam"] == "Provisioning Ops"
    assert payload["sourceQuoteNumber"] == "Q-1001"
    assert payload["sourceOpportunityId"] == opportunity_id


def test_convert_quote_to_order_requires_approved_quote(monkeypatch):
    quote_id = str(uuid.uuid4())

    def fake_get_view_row(view_name, key_name, value):
        if view_name == "ms.vQuoteDetail":
            return {"QuoteId": quote_id, "QuoteNumber": "Q-1001", "OpportunityId": str(uuid.uuid4()), "ApprovalStatus": "Pending"}
        raise AssertionError(view_name)

    monkeypatch.setattr(sales_compat, "ensure_sales_storage", lambda: None)
    monkeypatch.setattr(sales_compat, "ensure_ops_storage", lambda: None)
    monkeypatch.setattr(sales_compat, "get_view_row", fake_get_view_row)

    with pytest.raises(HTTPException) as exc_info:
        sales_compat.convert_quote_to_order(uuid.UUID(quote_id), {})

    assert exc_info.value.status_code == 400
    assert "approved" in exc_info.value.detail.lower()
