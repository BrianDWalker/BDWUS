# fc-gpt Phase 3 Browser Chain Coverage

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Added coverage

`web-ui/tests/full-business-chain.spec.js` adds a mocked browser test for the main cross-module chain:

1. Sales opens an active lead.
2. The lead is converted to an opportunity.
3. A quote is created from the opportunity.
4. The quote approval is approved.
5. Orders creates a new order.
6. The order is moved to provisioning.
7. Billing creates an invoice follow-up action.
8. Billing creates an adjustment.

## Remaining limits

- This is mocked browser coverage, not live staging data proof.
- It does not create a persisted customer-service ticket.
- It does not yet create an order directly from a live quote record.
- GitHub Actions still needs to confirm the test passes.
