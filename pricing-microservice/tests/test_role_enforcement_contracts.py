from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app, enforce_role_permissions
from app.services.authz import ROUTE_CAPABILITIES, ROLE_CAPABILITIES
import re
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.services.authz import issue_demo_role_token, required_capability_for_request, require_capability, role_can


def request_with_role(role: str, *, bearer: bool = True) -> Request:
    headers = []
    if bearer:
        token = issue_demo_role_token(role)["token"]
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))
    else:
        headers.append((b"x-demo-role", role.encode("utf-8")))
    return Request({"type": "http", "headers": headers})


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
    assert role_can("Care", "create:ticket")
    assert role_can("Care", "comment:ticket")


def test_protected_ops_routes_declare_capabilities():
    assert required_capability_for_request("POST", "/api/platform/customer-service/tickets") == "create:ticket"
    assert required_capability_for_request("PUT", "/api/platform/customer-service/tickets/ticket-1") == "update:ticket"
    assert required_capability_for_request("POST", "/api/platform/customer-service/tickets/ticket-1/notes") == "comment:ticket"
    assert required_capability_for_request("POST", "/api/ops/orders") == "create:order"
    assert required_capability_for_request("PUT", "/api/ops/orders/11111111-1111-4111-8111-111111111111") == "update:order"
    assert required_capability_for_request("POST", "/api/billing-workflows/invoices/55555555-5555-4555-8555-555555555555/actions") == "create:invoice-action"
    assert required_capability_for_request("POST", "/api/billing-workflows/adjustments") == "create:adjustment"
    assert required_capability_for_request("POST", "/api/admin/users") == "admin:write"
    assert required_capability_for_request("POST", "/api/admin/roles") == "admin:write"
    assert required_capability_for_request("POST", "/api/admin/integrations") == "admin:write"


def test_role_headers_no_longer_grant_access_by_default():
    dependency = require_capability("create:order")
    with pytest.raises(HTTPException) as exc:
        dependency(request_with_role("Sales", bearer=False))

    assert exc.value.status_code == 403
    assert exc.value.detail["role"] == "Viewer"


def test_protected_sales_routes_declare_capabilities():
    assert required_capability_for_request("POST", "/api/sales/opportunities") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/leads/11111111-1111-4111-8111-111111111111/convert") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes/11111111-1111-4111-8111-111111111111/submit-approval") == "create:quote"
    assert required_capability_for_request("POST", "/api/sales/quotes/11111111-1111-4111-8111-111111111111/convert-to-order") == "create:order"


# Exercise the actual middleware with side-effect-free probe handlers. The separate
# inventory assertion prevents newly registered routes silently escaping this matrix.

probe = FastAPI()
probe.middleware("http")(enforce_role_permissions)
for (_method, _path), _capability in ROUTE_CAPABILITIES.items():
    probe.add_api_route(re.sub(r"\{[^}]+\}", "sample", _path), lambda: {"ok": True}, methods=[_method])
probe.add_api_route("/api/unclassified", lambda: {"ok": True}, methods=["GET", "POST", "PUT", "DELETE"])
probe_client = TestClient(probe)


def test_every_registered_route_has_explicit_policy():
    inventory = {(method.upper(), path) for path, operations in app.openapi()["paths"].items()
                 if path.startswith("/api/") for method in operations
                 if method in {"get", "post", "put", "patch", "delete", "head", "options"}}
    assert inventory == set(ROUTE_CAPABILITIES)


@pytest.mark.parametrize("role", list(ROLE_CAPABILITIES))
@pytest.mark.parametrize("route,capability", list(ROUTE_CAPABILITIES.items()))
def test_role_route_matrix(role, route, capability):
    method, path = route
    path = re.sub(r"\{[^}]+\}", "sample", path)
    token = issue_demo_role_token(role)["token"]
    response = probe_client.request(method, path, headers={"authorization": f"Bearer {token}"})
    allowed = capability == "authenticated" or role == "Admin" or capability in ROLE_CAPABILITIES[role]
    assert response.status_code == (200 if allowed else 403)


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE"])
def test_unmapped_route_denied_even_to_admin(method):
    token = issue_demo_role_token("Admin")["token"]
    assert probe_client.request(method, "/api/unclassified", headers={"authorization": f"Bearer {token}"}).status_code == 403


def test_actor_comes_from_platform_not_payload(monkeypatch):
    import base64
    import json
    from app.services import ops_write
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "entra")
    monkeypatch.setenv("ENTRA_TENANT_ID", "tenant")
    principal = {"auth_typ": "aad", "claims": [{"typ": "tid", "val": "tenant"}, {"typ": "oid", "val": "real-object-id"}, {"typ": "roles", "val": "Billing"}]}
    headers = {"x-ms-client-principal": base64.b64encode(json.dumps(principal).encode()).decode()}
    saved = []
    monkeypatch.setattr(ops_write, "ensure_ops_storage", lambda: None)
    monkeypatch.setattr(ops_write, "execute", lambda sql, params: saved.append(params))
    monkeypatch.setattr(ops_write, "require_row", lambda *args: {})
    response = TestClient(app).post("/api/billing-workflows/adjustments", headers=headers, json={"createdBy": "forged", "amount": 1})
    assert response.status_code == 200
    assert "real-object-id" in saved[0]
    assert "forged" not in saved[0]


def test_bootstrap_does_not_bypass_read_permissions():
    from app.services.platform import filter_bootstrap
    payload = {"generatedAtUtc": "now", "dashboard": {}, "customers": [], "quotes": ["secret"], "users": ["secret"], "roles": ["secret"], "unknown": ["secret"]}
    assert set(filter_bootstrap(payload, "Care")) == {"generatedAtUtc", "dashboard", "customers"}
    assert set(filter_bootstrap(payload, "Viewer")) == {"generatedAtUtc"}
