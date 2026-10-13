import base64
import json
import pyodbc
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import billing_facts, sales
from app.services.authz import issue_demo_role_token

client = TestClient(app)


def principal(tenant="test-tenant", role="Admin"):
    return {"x-ms-client-principal": base64.b64encode(json.dumps({"auth_typ": "aad", "role_typ": "roles", "claims": [{"typ": "tid", "val": tenant}, {"typ": "roles", "val": role}]}).encode()).decode()}


def test_customers_route_with_database_mocked(monkeypatch):
    monkeypatch.setattr(sales, "ensure_sales_storage", lambda: None)
    monkeypatch.setattr(sales, "fetch_all", lambda *args: [{"CustomerNumber": "C-1"}])
    response = client.get("/api/billing/customers")
    assert response.status_code == 200
    assert response.json() == [{"CustomerNumber": "C-1"}]


def test_paginated_facts_route_with_database_mocked(monkeypatch):
    calls = []
    def fetch(sql, params):
        calls.append((sql, params))
        return [{"RecordId": "P-1", "Amount": 12}]
    monkeypatch.setattr(billing_facts, "fetch_all", fetch)
    response = client.get("/api/billing-facts/payments?limit=10&offset=20")
    assert response.status_code == 200
    assert response.json()[0]["Amount"] == 12
    assert calls[0][1] == (20, 10)
    assert "billing.vPortalPayments" in calls[0][0]


def test_facts_query_failure_returns_clear_error(monkeypatch):
    def unavailable(*args):
        raise pyodbc.OperationalError("database unavailable")
    monkeypatch.setattr(billing_facts, "fetch_all", unavailable)
    response = client.get("/api/billing-facts/usage")
    assert response.status_code == 503
    assert "owner review" in response.json()["detail"]


@pytest.mark.parametrize("path", ["/api/billing-facts/no-such-resource", "/api/billing-facts/payments?limit=1000"])
def test_invalid_facts_requests(path):
    assert client.get(path).status_code in {404, 422}


def test_entra_ignores_demo_token_and_role_header(monkeypatch):
    token = issue_demo_role_token("Admin")["token"]
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "entra")
    monkeypatch.setenv("ENTRA_TENANT_ID", "test-tenant")
    response = client.get("/api/auth/me", headers={"authorization": f"Bearer {token}", "x-user-role": "Admin"})
    assert response.status_code == 401
    assert client.get("/health").status_code == 200
    assert client.post("/api/auth/demo-token", headers=principal(), json={"role": "Admin"}).status_code == 404


def test_entra_uses_roles_and_rejects_wrong_tenant(monkeypatch):
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "entra")
    monkeypatch.setenv("ENTRA_TENANT_ID", "test-tenant")
    assert client.get("/api/auth/me", headers=principal()).json()["role"] == "Admin"
    assert client.get("/api/auth/me", headers=principal(role="unknown")).json()["role"] == "Viewer"
    assert client.get("/api/auth/me", headers=principal(tenant="wrong")).status_code == 401


def test_wildcard_cors_rejected(monkeypatch):
    from app.main import parse_allowed_origins
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://example.com,*")
    with pytest.raises(ValueError):
        parse_allowed_origins()


def test_migration_cannot_target_prod():
    from scripts.migrate_azure_sql_db import validate_target
    with pytest.raises(ValueError):
        validate_target("AZBDWUSP")
    validate_target("AZBDWUSDEV")
