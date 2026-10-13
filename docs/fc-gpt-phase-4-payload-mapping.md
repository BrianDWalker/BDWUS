# fc-gpt Phase 4 Payload Mapping Review

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Implemented

Phase 4 focused on API payload shape resilience for extracted modules.

Added shared mapping helpers in `web-ui/src/utils/payloadMapping.js` for:

- field fallback lookup
- array collection fallback lookup
- customer normalization
- order normalization
- provisioning job normalization
- network event normalization
- carrier settlement normalization
- invoice normalization
- ticket normalization

## Modules hardened

- Orders now normalizes order and provisioning job payloads.
- ServiceOps now accepts `settlements` or `carrierSettlements`, and normalizes network events, jobs, and settlement rows.
- Billing now normalizes customers, invoices, invoice actions, and adjustments.
- Customer Service now normalizes tickets, network issue rows, and summary metrics.
- Customer 360 now normalizes customer, location, and commercial record fields.

## Regression tests

Added `web-ui/tests/payload-mapping.spec.js` to prove camelCase and PascalCase payload variants normalize into stable UI fields.

## Remaining limits

- This does not prove live staging payloads because CI and staging calls cannot be executed from this chat.
- Product & Pricing and Reports already align closely with their current platform endpoints; they may still need live payload confirmation in staging.
- Sales detail payloads still use many raw sales-field names and should be reviewed in a later staging-specific pass if CI exposes drift.
