from __future__ import annotations

from collections.abc import Callable
from contextvars import ContextVar
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

from fastapi import HTTPException, Request
from app.services.smoke_data import smoke_mode_enabled


ROLE_CAPABILITIES: dict[str, set[str]] = {
    "Viewer": set(),
    "Executive": {"view:dashboard", "view:reports", "view:customers", "view:billing", "view:orders", "view:care", "view:network"},
    "Sales": {"view:dashboard", "view:sales", "view:customers", "create:quote", "create:order"},
    "Care": {"view:dashboard", "view:care", "view:customers", "create:ticket", "update:ticket", "comment:ticket", "escalate:ticket", "close:ticket"},
    "Billing": {"view:dashboard", "view:billing", "view:customers", "create:invoice-action", "create:adjustment"},
    "Ops": {"view:dashboard", "view:orders", "view:network", "update:order", "create:provisioning-job"},
    "Admin": {"*"},
}

for _role in ("Executive", "Sales", "Care", "Billing", "Ops"):
    ROLE_CAPABILITIES[_role].update({"view:pricing", "view:knowledge", "use:assistant"})

DEFAULT_ROLE = "Viewer"
ROLE_HEADER = "x-user-role"
DEMO_ROLE_HEADER = "x-demo-role"
AUTHORIZATION_HEADER = "authorization"
DEMO_AUTH_SECRET = secrets.token_urlsafe(32)
DEMO_AUTH_TTL_SECONDS = int(os.getenv("PLATFORM_AUTH_TOKEN_TTL_SECONDS", "28800"))
ALLOW_ROLE_HEADERS = os.getenv("ALLOW_ROLE_HEADERS", "").lower() in {"1", "true", "yes"}


# Explicit inventory: additions require policy and role-matrix review.
ROUTE_CAPABILITIES: dict[tuple[str, str], str] = {
    ('DELETE', '/api/sales/accounts/{account_id}'): 'create:quote',
    ('DELETE', '/api/sales/contracts/{contract_id}'): 'create:quote',
    ('DELETE', '/api/sales/contracts/{contract_id}/files/{file_id}'): 'create:quote',
    ('DELETE', '/api/sales/custom-pricing/{request_id}'): 'create:quote',
    ('DELETE', '/api/sales/leads/{lead_id}'): 'create:quote',
    ('DELETE', '/api/sales/opportunities/{opportunity_id}'): 'create:quote',
    ('DELETE', '/api/sales/opportunities/{opportunity_id}/products/{product_id}'): 'create:quote',
    ('DELETE', '/api/sales/quotes/{quote_id}'): 'create:quote',
    ('DELETE', '/api/sales/quotes/{quote_id}/line-items/{line_item_id}'): 'create:quote',
    ('DELETE', '/api/test-support/namespaces/{namespace}'): 'admin:write',
    ('GET', '/api/admin/integrations'): 'admin:read',
    ('GET', '/api/admin/roles'): 'admin:read',
    ('GET', '/api/admin/users'): 'admin:read',
    ('GET', '/api/assistant/github/branches'): 'admin:read',
    ('GET', '/api/assistant/github/file'): 'admin:read',
    ('GET', '/api/assistant/github/tree'): 'admin:read',
    ('GET', '/api/assistant/ui-overrides'): 'view:knowledge',
    ('GET', '/api/auth/me'): 'authenticated',
    ('GET', '/api/billing-facts/{resource}'): 'view:billing',
    ('GET', '/api/billing-workflows/adjustments'): 'view:billing',
    ('GET', '/api/billing-workflows/invoices'): 'view:billing',
    ('GET', '/api/billing-workflows/invoices/{invoice_id}'): 'view:billing',
    ('GET', '/api/billing-workflows/invoices/{invoice_id}/actions'): 'view:billing',
    ('GET', '/api/billing/billing-codes'): 'view:pricing',
    ('GET', '/api/billing/billing-elements'): 'view:pricing',
    ('GET', '/api/billing/customer-lookup/{customer_number}'): 'view:customers',
    ('GET', '/api/billing/customers'): 'view:customers',
    ('GET', '/api/billing/customers/{customer_number}'): 'view:customers',
    ('GET', '/api/billing/offers'): 'view:pricing',
    ('GET', '/api/billing/product-hierarchy'): 'view:pricing',
    ('GET', '/api/billing/products'): 'view:pricing',
    ('GET', '/api/billing/products/{product_id}'): 'view:pricing',
    ('GET', '/api/billing/promotions'): 'view:pricing',
    ('GET', '/api/billing/rate-plans'): 'view:pricing',
    ('GET', '/api/ops/bootstrap'): 'view:dashboard',
    ('GET', '/api/ops/carrier-settlement'): 'view:billing',
    ('GET', '/api/ops/network-events'): 'view:network',
    ('GET', '/api/ops/orders'): 'view:orders',
    ('GET', '/api/ops/provisioning-jobs'): 'view:network',
    ('GET', '/api/platform/administration/summary'): 'admin:read',
    ('GET', '/api/platform/bootstrap'): 'view:dashboard',
    ('GET', '/api/platform/customer-360/{customer_number}'): 'view:customers',
    ('GET', '/api/platform/customer-service/overview'): 'view:care',
    ('GET', '/api/platform/customer-service/tickets'): 'view:care',
    ('GET', '/api/platform/customer-service/tickets/{ticket_id}'): 'view:care',
    ('GET', '/api/platform/knowledge/bootstrap'): 'view:knowledge',
    ('GET', '/api/platform/knowledge/documents'): 'view:knowledge',
    ('GET', '/api/platform/knowledge/topics'): 'view:knowledge',
    ('GET', '/api/platform/product-pricing/overview'): 'view:pricing',
    ('GET', '/api/platform/reports/definitions'): 'view:reports',
    ('GET', '/api/platform/reports/{report_id}'): 'view:reports',
    ('GET', '/api/sales/accounts'): 'view:sales',
    ('GET', '/api/sales/accounts/{account_id}'): 'view:sales',
    ('GET', '/api/sales/approvals'): 'view:sales',
    ('GET', '/api/sales/approvals/{approval_id}'): 'view:sales',
    ('GET', '/api/sales/bootstrap'): 'view:sales',
    ('GET', '/api/sales/contracts'): 'view:sales',
    ('GET', '/api/sales/contracts/{contract_id}'): 'view:sales',
    ('GET', '/api/sales/contracts/{contract_id}/files'): 'view:sales',
    ('GET', '/api/sales/contracts/{contract_id}/history'): 'view:sales',
    ('GET', '/api/sales/custom-pricing'): 'view:sales',
    ('GET', '/api/sales/custom-pricing/{request_id}'): 'view:sales',
    ('GET', '/api/sales/dashboard'): 'view:sales',
    ('GET', '/api/sales/leads'): 'view:sales',
    ('GET', '/api/sales/leads/{lead_id}'): 'view:sales',
    ('GET', '/api/sales/leads/{lead_id}/activities'): 'view:sales',
    ('GET', '/api/sales/opportunities'): 'view:sales',
    ('GET', '/api/sales/opportunities/{opportunity_id}'): 'view:sales',
    ('GET', '/api/sales/opportunities/{opportunity_id}/notes'): 'view:sales',
    ('GET', '/api/sales/opportunities/{opportunity_id}/products'): 'view:sales',
    ('GET', '/api/sales/quotes'): 'view:sales',
    ('GET', '/api/sales/quotes/{quote_id}'): 'view:sales',
    ('GET', '/api/sales/quotes/{quote_id}/line-items'): 'view:sales',
    ('POST', '/api/admin/integrations'): 'admin:write',
    ('POST', '/api/admin/roles'): 'admin:write',
    ('POST', '/api/admin/users'): 'admin:write',
    ('POST', '/api/assistant/change-requests/{change_request_id}/approve'): 'admin:write',
    ('POST', '/api/assistant/change-requests/{change_request_id}/reject'): 'admin:write',
    ('POST', '/api/assistant/chat'): 'use:assistant',
    ('POST', '/api/auth/demo-token'): 'authenticated',
    ('POST', '/api/billing-workflows/adjustments'): 'create:adjustment',
    ('POST', '/api/billing-workflows/invoices/{invoice_id}/actions'): 'create:invoice-action',
    ('POST', '/api/ops/carrier-settlement'): 'create:adjustment',
    ('POST', '/api/ops/network-events'): 'create:provisioning-job',
    ('POST', '/api/ops/orders'): 'create:order',
    ('POST', '/api/ops/provisioning-jobs'): 'create:provisioning-job',
    ('POST', '/api/platform/customer-service/tickets'): 'create:ticket',
    ('POST', '/api/platform/customer-service/tickets/{ticket_id}/notes'): 'comment:ticket',
    ('POST', '/api/sales/accounts'): 'create:quote',
    ('POST', '/api/sales/approvals/{approval_id}/approve'): 'approve:quote',
    ('POST', '/api/sales/approvals/{approval_id}/reject'): 'approve:quote',
    ('POST', '/api/sales/approvals/{approval_id}/request-changes'): 'approve:quote',
    ('POST', '/api/sales/contracts'): 'create:quote',
    ('POST', '/api/sales/contracts/{contract_id}/files'): 'create:quote',
    ('POST', '/api/sales/custom-pricing'): 'create:quote',
    ('POST', '/api/sales/custom-pricing/{request_id}/submit'): 'create:quote',
    ('POST', '/api/sales/leads'): 'create:quote',
    ('POST', '/api/sales/leads/{lead_id}/activities'): 'create:quote',
    ('POST', '/api/sales/leads/{lead_id}/convert'): 'create:quote',
    ('POST', '/api/sales/opportunities'): 'create:quote',
    ('POST', '/api/sales/opportunities/{opportunity_id}/notes'): 'create:quote',
    ('POST', '/api/sales/opportunities/{opportunity_id}/products'): 'create:quote',
    ('POST', '/api/sales/quotes'): 'create:quote',
    ('POST', '/api/sales/quotes/{quote_id}/convert-to-order'): 'create:order',
    ('POST', '/api/sales/quotes/{quote_id}/line-items'): 'create:quote',
    ('POST', '/api/sales/quotes/{quote_id}/price'): 'create:quote',
    ('POST', '/api/sales/quotes/{quote_id}/submit-approval'): 'create:quote',
    ('POST', '/api/sales/serviceability/check'): 'create:quote',
    ('POST', '/api/test-support/namespaces/{namespace}/workflow-seed'): 'admin:write',
    ('PUT', '/api/ops/orders/{order_id}'): 'update:order',
    ('PUT', '/api/ops/provisioning-jobs/{job_id}'): 'create:provisioning-job',
    ('PUT', '/api/platform/customer-service/tickets/{ticket_id}'): 'update:ticket',
    ('PUT', '/api/sales/accounts/{account_id}'): 'create:quote',
    ('PUT', '/api/sales/contracts/{contract_id}'): 'create:quote',
    ('PUT', '/api/sales/custom-pricing/{request_id}'): 'create:quote',
    ('PUT', '/api/sales/leads/{lead_id}'): 'create:quote',
    ('PUT', '/api/sales/opportunities/{opportunity_id}'): 'create:quote',
    ('PUT', '/api/sales/opportunities/{opportunity_id}/products/{product_id}'): 'create:quote',
    ('PUT', '/api/sales/quotes/{quote_id}'): 'create:quote',
    ('PUT', '/api/sales/quotes/{quote_id}/line-items/{line_item_id}'): 'create:quote',
}

ROUTE_RULES = tuple(
    (method, re.compile("^" + re.sub(r"\{[^}]+\}", "[^/]+", path) + "/?$"), capability)
    for (method, path), capability in ROUTE_CAPABILITIES.items()
)

# Request-local audit identity, propagated to synchronous handlers.
ACTOR = ContextVar("authenticated_actor", default="local:Viewer")

def authenticated_actor() -> str:
    return ACTOR.get()

def actor_from_request(request: Request) -> str:
    if auth_mode() == "local":
        return "local:" + active_role_from_request(request)
    claims = platform_principal(request)["claims"]
    for claim_type in ("oid", "http://schemas.microsoft.com/identity/claims/objectidentifier", "sub"):
        for claim in claims:
            if claim["typ"] == claim_type and claim["val"]:
                return claim["val"]
    raise HTTPException(status_code=401, detail="Authenticated subject is required")

def normalize_role(role: str | None) -> str:
    if not role:
        return DEFAULT_ROLE
    return next((known for known in ROLE_CAPABILITIES if known.lower() == role.strip().lower()), DEFAULT_ROLE)


def capabilities_for_role(role: str | None) -> set[str]:
    return ROLE_CAPABILITIES.get(normalize_role(role), ROLE_CAPABILITIES[DEFAULT_ROLE])


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _sign_token(message: str) -> str:
    digest = hmac.new(DEMO_AUTH_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return _base64url_encode(digest)


def issue_demo_role_token(role: str | None, ttl_seconds: int = DEMO_AUTH_TTL_SECONDS) -> dict[str, object]:
    if auth_mode() != "local":
        raise HTTPException(status_code=404, detail="Demo authentication is disabled")
    normalized_role = normalize_role(role)
    now = int(time.time())
    payload = {
        "role": normalized_role,
        "iat": now,
        "exp": now + ttl_seconds,
        "kind": "demo-role",
    }
    payload_segment = _base64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature_segment = _sign_token(payload_segment)
    return {
        "token": f"{payload_segment}.{signature_segment}",
        "role": normalized_role,
        "expiresAt": payload["exp"],
        "capabilities": sorted(capabilities_for_role(normalized_role)),
    }


def role_from_bearer_token(token: str | None) -> str | None:
    if not token or "." not in token:
        return None
    payload_segment, signature_segment = token.split(".", 1)
    if not hmac.compare_digest(signature_segment, _sign_token(payload_segment)):
        return None
    try:
        payload = json.loads(_base64url_decode(payload_segment).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("kind") != "demo-role":
        return None
    if int(payload.get("exp") or 0) < int(time.time()):
        return None
    return normalize_role(payload.get("role"))


def bearer_token_from_request(request: Request) -> str | None:
    auth_header = request.headers.get(AUTHORIZATION_HEADER) or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip() or None


def auth_mode() -> str:
    return os.getenv("PLATFORM_AUTH_MODE", "local" if smoke_mode_enabled() else "entra")


def platform_principal(request: Request) -> dict:
    """Only trust this header behind Container Apps Easy Auth ingress."""
    encoded = request.headers.get("x-ms-client-principal", "")
    tenant = os.getenv("ENTRA_TENANT_ID", "")
    try:
        principal = json.loads(base64.b64decode(encoded, validate=True))
        if not isinstance(principal, dict) or principal.get("auth_typ") != "aad":
            raise ValueError("Invalid identity provider")
        claims = principal.get("claims", [])
        if not isinstance(claims, list) or not all(
            isinstance(c, dict) and isinstance(c.get("typ"), str) and isinstance(c.get("val"), str) for c in claims
        ):
            raise ValueError("Invalid claims")
        tenant_claims = [c.get("val") for c in claims if c.get("typ") in {
            "tid", "http://schemas.microsoft.com/identity/claims/tenantid"
        }]
        if not tenant or tenant not in tenant_claims:
            raise ValueError("Invalid tenant")
        return principal
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(status_code=401, detail="Entra sign-in is required") from None


def active_role_from_request(request: Request) -> str:
    if auth_mode() == "entra":
        principal = platform_principal(request)
        role_type = principal.get("role_typ", "roles")
        roles = {c.get("val") for c in principal.get("claims", []) if c.get("typ") in {
            role_type, "roles", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
        }}
        # Pick one application role deterministically; unknown claims grant nothing.
        return next((role for role in reversed(ROLE_CAPABILITIES) if role in roles), DEFAULT_ROLE)
    if auth_mode() != "local":
        return DEFAULT_ROLE
    token_role = role_from_bearer_token(bearer_token_from_request(request))
    if token_role:
        return token_role
    if ALLOW_ROLE_HEADERS or smoke_mode_enabled():
        return normalize_role(request.headers.get(ROLE_HEADER) or request.headers.get(DEMO_ROLE_HEADER))
    return DEFAULT_ROLE


def role_can(role: str | None, capability: str) -> bool:
    capabilities = capabilities_for_role(role)
    return capability == "authenticated" or "*" in capabilities or capability in capabilities


def required_capability_for_request(method: str, path: str) -> str | None:
    normalized_method = method.upper()
    for rule_method, pattern, capability in ROUTE_RULES:
        if rule_method == normalized_method and pattern.match(path):
            return capability
    return None


def require_capability(capability: str) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        role = active_role_from_request(request)
        if not role_can(role, capability):
            raise HTTPException(
                status_code=403,
                detail={
                    "message": f"{role} does not have permission for {capability}.",
                    "role": role,
                    "requiredCapability": capability,
                },
            )

    setattr(dependency, "required_capability", capability)
    return dependency
