from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.services.authz import issue_demo_role_token, normalize_role


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/demo-token")
def issue_demo_token(payload: dict[str, Any] | None = None):
    requested_role = normalize_role((payload or {}).get("role"))
    return issue_demo_role_token(requested_role)
