from __future__ import annotations

from collections.abc import Callable
import base64
import hashlib
import hmac
import json
import os
import re
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

DEFAULT_ROLE = "Viewer"
ROLE_HEADER = "x-user-role"
DEMO_ROLE_HEADER = "x-demo-role"
AUTHORIZATION_HEADER = "authorization"
DEMO_AUTH_SECRET = os.getenv("PLATFORM_AUTH_TOKEN_SECRET", "fc-gpt-demo-role-secret")
DEMO_AUTH_TTL_SECONDS = int(os.getenv("PLATFORM_AUTH_TOKEN_TTL_SECONDS", "28800"))
ALLOW_ROLE_HEADERS = os.getenv("ALLOW_ROLE_HEADERS", "").lower() in {"1", "true", "yes"}


PROTECTED_MUTATION_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    ("POST", re.compile(r"^/api/platform/customer-service/tickets/?$"), "create:ticket"),
    ("PUT", re.compile(r"^/api/platform/customer-service/tickets/[^/]+/?$"), "update:ticket"),
    ("POST", re.compile(r"^/api/platform/customer-service/tickets/[^/]+/notes/?$"), "comment:ticket"),
    ("POST", re.compile(r"^/api/ops/orders/?$"), "create:order"),
    ("PUT", re.compile(r"^/api/ops/orders/[^/]+/?$"), "update:order"),
    ("POST", re.compile(r"^/api/ops/provisioning-jobs/?$"), "create:provisioning-job"),
    ("POST", re.compile(r"^/api/ops/network-events/?$"), "create:provisioning-job"),
    ("POST", re.compile(r"^/api/ops/carrier-settlement/?$"), "create:adjustment"),
    ("POST", re.compile(r"^/api/admin/(users|roles|integrations)/?$"), "admin:write"),
    ("POST", re.compile(r"^/api/test-support/.*$"), "admin:write"),
    ("DELETE", re.compile(r"^/api/test-support/.*$"), "admin:write"),
    ("POST", re.compile(r"^/api/billing-workflows/invoices/[^/]+/actions/?$"), "create:invoice-action"),
    ("POST", re.compile(r"^/api/billing-workflows/adjustments/?$"), "create:adjustment"),
    ("POST", re.compile(r"^/api/sales/quotes/[^/]+/convert-to-order/?$"), "create:order"),
    ("POST", re.compile(r"^/api/sales/(leads|accounts|opportunities|custom-pricing|quotes|approvals|contracts)(/.*)?$"), "create:quote"),
    ("PUT", re.compile(r"^/api/sales/(leads|accounts|opportunities|custom-pricing|quotes|contracts)(/.*)?$"), "create:quote"),
    ("DELETE", re.compile(r"^/api/sales/(leads|accounts|opportunities|custom-pricing|quotes|contracts)(/.*)?$"), "create:quote"),
)


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


def active_role_from_request(request: Request) -> str:
    token_role = role_from_bearer_token(bearer_token_from_request(request))
    if token_role:
        return token_role
    if ALLOW_ROLE_HEADERS or smoke_mode_enabled():
        return normalize_role(request.headers.get(ROLE_HEADER) or request.headers.get(DEMO_ROLE_HEADER))
    return DEFAULT_ROLE


def role_can(role: str | None, capability: str) -> bool:
    capabilities = capabilities_for_role(role)
    return "*" in capabilities or capability in capabilities


def required_capability_for_request(method: str, path: str) -> str | None:
    normalized_method = method.upper()
    for rule_method, pattern, capability in PROTECTED_MUTATION_RULES:
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
