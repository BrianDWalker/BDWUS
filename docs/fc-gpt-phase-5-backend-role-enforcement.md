# fc-gpt Phase 5 Backend Role Enforcement

Phase 5 moves permission checks from frontend-only controls into a FastAPI middleware for protected mutation paths.

## Implemented

- Added shared backend authorization helper and protected method/path capability map in `pricing-microservice/app/services/authz.py`.
- Added backend middleware in `pricing-microservice/app/main.py` that rejects unauthorized protected mutations before route handlers touch Azure SQL.
- Backend protected mutations now deny by default when no role is provided.
- Supported request role headers:
  - `X-User-Role` for a future authenticated/user-profile role source.
  - `X-Demo-Role` for the current demo/testing role selector.
- Added capability checks for:
  - order creation and order progression
  - provisioning job creation
  - invoice actions and billing adjustments
  - admin user, role, and integration creation
  - sales lead/account/opportunity/quote/approval/contract mutations
  - compatibility sales mutation routes registered before the main sales router
  - quote-to-order conversion
- Updated frontend mutation clients to send the active demo role through `X-Demo-Role`.
- Added backend contract tests covering denied Viewer behavior, missing-role denial, allowed role capabilities, and protected method/path mappings.

## Capability Map

- `create:order`: Sales, Admin
- `update:order`: Ops, Admin
- `create:provisioning-job`: Ops, Admin
- `create:invoice-action`: Billing, Admin
- `create:adjustment`: Billing, Admin
- `create:quote`: Sales, Admin
- `admin:write`: Admin

The frontend role selector remains explicitly labeled as a demo permission role. The backend honors that selector through `X-Demo-Role` so preview workflows can verify both allowed and denied paths.

## Remaining Auth Maturity

This phase does not add a real identity provider or signed token validation. `X-User-Role` is reserved for the eventual authoritative role source, but it is still only a header today. A later security phase should replace header trust with token/session/user-profile validation and derive API roles server-side.
