# fc-gpt Final Verification Checklist

Use this checklist before calling `fc-gpt` ready for demo or release review.

## 1. GitHub Actions

- [ ] Open the latest `fc-gpt Validation` run.
- [ ] Confirm web UI build passed.
- [ ] Confirm web route smoke passed.
- [ ] Confirm pricing microservice compile/tests passed.
- [ ] Confirm Azure SQL schema validation passed, or confirm it was intentionally skipped because `SQL_SCHEMA_VALIDATION_ENABLED` is not enabled for this repo/environment.
- [ ] Confirm workflow contract smoke passed.
- [ ] Confirm full platform runtime smoke passed.
- [ ] Confirm assistant-service tests passed.
- [ ] Confirm full platform staging smoke passed.
- [ ] Confirm preview submit workflow smoke passed, or confirm it was intentionally skipped because `PREVIEW_SUBMIT_SMOKE_ENABLED` is not enabled for this repo/environment.
- [ ] Confirm deployed web route smoke passed.

## 2. Web UI routes

Confirm these routes render with the new top shell and no blank page:

- [ ] `#/sales`
- [ ] `#/reports`
- [ ] `#/administration`
- [ ] `#/product-pricing`
- [ ] `#/customer-360`
- [ ] `#/customer-service`
- [ ] `#/billing`
- [ ] `#/orders`
- [ ] `#/network`
- [ ] `#/service-management`
- [ ] `#/provisioning`
- [ ] `#/carrier-settlement`

## 3. Business chain smoke

- [ ] Lead list loads.
- [ ] Lead conversion opens and saves.
- [ ] Opportunity list refreshes.
- [ ] Quote creation opens and saves.
- [ ] Approval action opens and saves.
- [ ] Orders page loads.
- [ ] New order action works.
- [ ] Provision action works.
- [ ] Billing page loads.
- [ ] Invoice action works.
- [ ] Adjustment action works.

## 4. Payload checks

Check staging payloads for casing and collection names:

- [ ] Customer records.
- [ ] Customer 360 records.
- [ ] Customer Service tickets.
- [ ] Orders.
- [ ] Provisioning jobs.
- [ ] Network events.
- [ ] Carrier settlements.
- [ ] Invoices.
- [ ] Invoice actions.
- [ ] Adjustments.

## 5. Visual QA

- [ ] Desktop layout has no major overflow.
- [ ] Tablet layout stacks correctly.
- [ ] Mobile layout stacks correctly.
- [ ] Top navigation works.
- [ ] Global search opens/closes and routes correctly.
- [ ] Utility menus open/close and route correctly.
- [ ] Tables scroll horizontally where needed.
- [ ] Buttons have visible focus states.
- [ ] Empty states look intentional.
- [ ] Error states are readable.

## 6. Known accepted gaps

Do not block internal review on these unless the release scope changes:

- Broader mobile/tablet redesign remains outside the current completion scope.
