# fc-gpt Phase 8 Quote-to-Order Implementation

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Phase 7 check performed first

I inspected `.github/workflows/fc-gpt-validation.yml`. The workflow still covers web build, browser route smoke, pricing microservice tests, runtime smoke, assistant-service tests, deployed API baseline smoke, full platform staging smoke, and deployed web route smoke.

I still could not confirm the latest GitHub Actions run result from this chat.

## Implemented in Phase 8

Added backend quote-to-order handoff support in `pricing-microservice/app/services/sales_compat.py`:

- `POST /api/sales/quotes/{quote_id}/convert-to-order`
- Requires quote `ApprovalStatus` to be `Approved` or `Ready`.
- Derives order context from quote, opportunity, and quote line items.
- Creates an `ops.Orders` record.
- Returns the created order plus source quote metadata.

Added frontend API client support in `web-ui/src/utils/salesApi.js`:

- `convertQuoteToOrder(id, payload)`

Added backend contract tests in `pricing-microservice/tests/test_quote_to_order_contract.py`:

- route registration
- quote/order payload context derivation
- rejection of non-approved quotes

## Could not complete from here

- I did not add a visible Sales UI button because `SalesDatabaseCRM.jsx` is a large high-risk full-file replacement through the connector without local test execution.
- A small browser-side handoff test was attempted, but the connector safety filter blocked creation.
- The endpoint still needs GitHub Actions confirmation and live staging proof.

## Recommended next small follow-up

After CI is checked, add a visible `Create Order` action for approved quotes in `SalesDatabaseCRM.jsx` and wire it to `convertQuoteToOrder`. Then update the full-chain browser test to use that button instead of standalone order creation.
