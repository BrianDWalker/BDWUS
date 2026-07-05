import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.services.authz import required_capability_for_request, require_capability, role_can


def request_with_role(role: str) -> Request:
    return Request({"type": "http", "headers": [(b"x-demo-role", role.encode("utf-8"))]})


def test_viewer_cannot_create_order():
    dependency = require_capability("create:order")
    with pytest.raises(HTTPException) as exc:
        dependency(request_with_role("Viewer"))

    assert exc.value.status_code == 403
    assert exc.value.detail["role"] == "Viewer"
    assert exc.value.detail["requiredCapability"] == "create:order"


def test_missing_role_defaults_to_viewer_denial():
    dependency = require_capability("admin:write")
    with pytest.raises(HTTPException) as exc:
        dependency(Request({"type": "http", "headers": []}))

    assert exc.value.status_code == 403
    assert exc.value.detail["role"] == "Viewer"


def test_allowed_roles_cover_phase_5_mutation_groups():
    assert role_can("Billing", "create:invoice-action")
    assert role_can("Billing", "create:adjustment")
    assert role_can("Admin", "admin:write")
    assert role_can("Sales", "create:quote")
    assert role_can("Sales", "create:order")


def test_protected_ops_routes_declare_capabilities():
    assert required_capability_for_request("POST", "/api/ops/orders") == "create:order"
    assert required_capability_for_request("PUT", "/api/ops/orders/11111111-1111-4111-8111-111111111111") == "update:order"
    assert required_capability_for_request("POST", "/api/billing-workflows/invoices/55555555-5555-4555-8555-555555555555/actions") == "create:invoice-action"
    assert required_capability_for_request("POST", "/api/billing-workflows/adjustments") == "create:adjustment"
    assert required_capability_for_request("POST", "/api/admin/users") == "admin:write"
    assert required_capability_for_request("POST", "/api/admin/roles") == "admin:write"
    assert required_capability_for_request("POST", "/api/admin/integrations") == "admin:write"


def test_protected_sales_routes_declare_capabilities():
    assert required_capability_for_request("POST", "/api/sales/opportunities") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/leads/11111111-1111-4111-8111-111111111111/convert") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes/11111111-1111-4111-8111-111111111111/submit-approval") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes/11111111-1111-4111-8111-111111111111/convert-to-order") == "create:order"
