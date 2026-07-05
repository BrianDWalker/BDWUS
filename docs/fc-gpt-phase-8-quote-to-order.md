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

Added visible Sales UI support in `web-ui/src/SalesAppRouter.jsx`:

- Quote detail routes render `Create Order from Quote`.
- The action calls `convertQuoteToOrder`.
- On success, the UI shows a toast and routes to Orders.
- On failure, the UI shows the error message as a toast.

Added styling in `web-ui/src/quote-to-order.css` and imported it from `web-ui/src/main.jsx`.

Added backend contract tests in `pricing-microservice/tests/test_quote_to_order_contract.py`:

- route registration
- quote/order payload context derivation
- rejection of non-approved quotes

Added browser smoke coverage in `web-ui/tests/sales-quote-action.spec.js`:

- quote detail route exposes the create-order action
- action calls the mocked handoff endpoint
- success toast is displayed

## Still not completed from here

- I still cannot confirm GitHub Actions pass/fail status from this chat.
- I still cannot prove the endpoint against live staging data from this chat.
- The original full-chain browser spec still uses standalone order creation; it should be updated later to use the visible quote-to-order button once CI is available.
