# fc-gpt Phase 1-4 Open Items Review

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Items now completed by later phases

- Customer Service extraction: completed. `customer-service` now routes to `CustomerServiceModule` and uses `GET /api/platform/customer-service/overview`.
- Mocked full business-chain E2E: completed. `web-ui/tests/full-business-chain.spec.js` covers lead conversion, quote creation, approval, order creation, provisioning, invoice action, and adjustment.
- Payload shape resilience: completed for the highest-risk extracted modules. Orders, ServiceOps, Billing, Customer Service, and Customer 360 now use shared payload normalization helpers.
- Customer Service route ownership: completed. It is no longer listed as an intentional LegacyPortal route.

## Items still not able to be completed from this chat

- GitHub Actions pass/fail confirmation. The branch needs the GitHub Actions UI or workflow-run access to verify the latest commits.
- Live staging payload proof. The current work hardens payload mapping, but it does not execute deployed staging API calls from here.
- Browser/manual visual QA proof. CSS and component consistency can be improved here, but final visual confirmation needs a browser run.

## Items still intentionally open

- `dashboard` and `knowledge` remain in LegacyPortal until dedicated extracted replacements are built.
- `details/ticket/*`, `details/network/*`, `details/record/*`, and unknown stale detail links remain LegacyPortal fallbacks.
- Customer Service ticket persistence is not implemented yet. The current create-ticket action is still a UI draft action.
- The full-chain E2E does not create an order directly from a persisted live quote record yet.
- Sales detail pages still have raw sales field assumptions and may need a future staging-specific hardening pass.

## Phase 5 readiness

It is safe to proceed with Phase 5 as a controlled UI consistency pass, provided the work avoids deleting LegacyPortal and does not claim CI/staging proof.
