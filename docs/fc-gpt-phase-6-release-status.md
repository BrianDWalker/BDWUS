# fc-gpt Phase 6 Release Status

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Current posture

`fc-gpt` is now a strong internal release-candidate branch. It has extracted route ownership, Customer Service extraction, browser-level mocked chain coverage, payload normalization, and a shared UI consistency layer.

It should not be called fully released until GitHub Actions, staging payload checks, and browser visual QA are confirmed.

## Completed through Phase 5

- Route ownership inventory and registry.
- Customer Service extracted from intentional LegacyPortal ownership.
- Customer Service read endpoint: `GET /api/platform/customer-service/overview`.
- Mocked browser chain covering lead conversion, quote creation, approval, order creation, provisioning, invoice action, and adjustment.
- Payload normalization helpers for common casing and collection drift.
- Payload hardening for Orders, ServiceOps, Billing, Customer Service, and Customer 360.
- UI consistency layer for shared primitives, tables, panels, actions, empty states, focus states, and responsive layouts.

## Remaining items that still require external confirmation

- Latest GitHub Actions pass/fail status.
- Runtime and staging smoke confirmation.
- Deployed/staging browser route smoke confirmation.
- Live staging payload proof.
- Manual visual QA in a browser.

## Remaining intentional product gaps

- `dashboard` remains in LegacyPortal.
- `knowledge` remains in LegacyPortal.
- `details/ticket/*`, `details/network/*`, `details/record/*`, and unknown stale details remain fallback routes.
- Customer Service create-ticket is still a UI draft action, not persistent ticket storage.
- The full-chain browser test does not yet create an order directly from a persisted live quote record.
- Sales detail pages may still need field-mapping hardening if staging shows drift.

## Internal demo readiness

Ready to review as an internal/staging candidate after the latest CI run is checked.

Do not present it as broadly release-ready until:

- GitHub Actions is green.
- Staging API payloads are confirmed.
- Visual QA is complete.
- Remaining LegacyPortal surfaces have explicit accept/migrate/remove decisions.
