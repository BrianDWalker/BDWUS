# fc-gpt Phase 9 Customer Service Ticket Persistence

Scope: `fc-gpt` only. No merge, rebase, or branch reconciliation was performed.

## Implemented

Phase 9 closes the prior Customer Service ticket persistence gap.

Backend changes:

- Added persistent `care.Tickets` storage.
- Added persistent `care.TicketNotes` storage.
- Added seeded ticket data for non-smoke runtime.
- Preserved smoke-mode ticket behavior for CI/runtime smoke.
- Added `GET /api/platform/customer-service/tickets`.
- Added `POST /api/platform/customer-service/tickets`.
- Added `GET /api/platform/customer-service/tickets/{ticket_id}`.
- Added `PUT /api/platform/customer-service/tickets/{ticket_id}`.

Frontend changes:

- Added Customer Service ticket API client helpers.
- Replaced the UI-only ticket draft action with an API-backed create-ticket action.
- New tickets route to `details/ticket/{ticketId}` after creation.
- Added `CustomerServiceTicketDetail` for modern ticket detail rendering.
- Added ticket close/update action from the detail page.
- Moved `details/ticket/*` out of intentional LegacyPortal ownership.

Tests added/updated:

- Backend tests for customer-service route registration, smoke create/detail/update, and 404 behavior.
- Route ownership tests proving `details/ticket/*` is extracted and no longer intentional legacy.
- Browser tests for customer-service create/open flow and ticket detail close action.

## Still not completed from here

- GitHub Actions pass/fail confirmation.
- Live staging proof against Azure SQL.
- Manual browser visual QA.
- More advanced ticket workflow features like assignment queues, comments composer, SLA timers, escalation, attachments, and full closure reason capture.

## Current status

The main Phase 9 gap is now closed at code/test level: Customer Service ticket creation is no longer just a UI draft. It is API-backed and has a modern extracted ticket detail page.
