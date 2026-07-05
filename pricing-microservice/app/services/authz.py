from __future__ import annotations

from collections.abc import Callable
import re

from fastapi import HTTPException, Request


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


PROTECTED_MUTATION_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    ("POST", re.compile(r"^/api/ops/orders/?$"), "create:order"),
    ("PUT", re.compile(r"^/api/ops/orders/[^/]+/?$"), "update:order"),
    ("POST", re.compile(r"^/api/ops/provisioning-jobs/?$"), "create:provisioning-job"),
    ("POST", re.compile(r"^/api/admin/(users|roles|integrations)/?$"), "admin:write"),
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


def active_role_from_request(request: Request) -> str:
    return normalize_role(request.headers.get(ROLE_HEADER) or request.headers.get(DEMO_ROLE_HEADER))


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
