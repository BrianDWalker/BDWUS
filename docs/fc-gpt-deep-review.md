# fc-gpt Branch Deep Review

## Executive Summary

The `fc-gpt` branch significantly advances the BDWUS Web UI toward a Copilot-style telecom operations experience, but the branch is still incomplete as an end-to-end system. The UI now presents a rich assistant workspace, repository browsing, approvals, and expanded telecom modules. However, much of the branch remains UI-first and mock-data-driven, while the only verified in-repo backend service remains the pricing/customer lookup FastAPI microservice.

The practical result is that `fc-gpt` currently behaves more like a high-fidelity product shell than a fully wired operating platform. The assistant experience appears capable of connecting Web UI -> assistant/microservice -> Azure SQL / Azure AI Foundry / GitHub, but only part of that chain is verifiably implemented in the repository.

## Most Important Conclusions

1. The `fc-gpt` branch adds a substantial AI and developer-facing UI layer in `web-ui`, but the repository still does not contain a verified in-repo assistant backend that implements the full `/api/assistant/*` contract expected by the UI.
2. The portal business modules are still largely powered by local mock data and derived client-side records instead of service-backed reads and writes.
3. The `pricing-microservice` is real and materially more complete than the rest of the backend, but it covers pricing/customer lookup and quote history only. It does not cover the wider AI assistant, GitHub agent, or most telecom operations modules.
4. Documentation and deployment instructions are out of sync with the actual codebase in several places.
5. `fc-gpt` should be treated as a branch in transition: strong product direction, incomplete architecture, missing service integration, and several placeholder workflows.

## Architecture Assessment

### Intended Architecture

The intended architecture appears to be:

- Web UI (React/Vite)
- Assistant service / agent orchestration layer
- Telecom domain services
- Azure SQL for transactional and read-model data
- Azure AI Foundry for model execution
- GitHub tooling for repo browsing and controlled writes

### Current Reality in `fc-gpt`

The actual verified architecture in-repo is closer to:

- React/Vite Web UI with telecom module surfaces and assistant UX
- Mock data powering many portal modules
- One real FastAPI pricing microservice backed by Azure SQL
- A UI contract for assistant APIs that points to an external container app
- No fully verified in-repo implementation of the assistant contract

This gap between intended and actual architecture is the root issue across most modules.

## Module-by-Module Deep Review

---

## 1. AI Assistant / Copilot Experience

### Current Design Flaws

- The assistant UI is highly developed, but it is structurally dependent on an external assistant API base URL rather than a clearly versioned, in-repo backend service.
- The UI presents Azure SQL, Azure AI Foundry, GitHub, and Knowledge Base as connected systems even though the checked-in backend implementation for those capabilities is not all present in this repository.
- The current design makes the UI appear more capable than the verified backend supports, which creates expectation mismatch and debugging difficulty.
- The assistant conversation layer simulates streaming in the UI after receiving the full response, rather than using a real server streaming channel.
- The assistant contract appears broad and operationally powerful, but there is no visible authentication, authorization, approval audit, or execution-trace model implemented in the verified backend inspected for this review.

### What Is Missing

- Checked-in assistant backend implementation for:
  - `/api/assistant/chat`
  - `/api/assistant/ui-overrides`
  - `/api/assistant/change-requests/{id}/approve`
  - `/api/assistant/change-requests/{id}/reject`
  - `/api/assistant/github/branches`
  - `/api/assistant/github/tree`
  - `/api/assistant/github/file`
- Real request tracing and audit logs
- User identity propagation into assistant actions
- Real SSE or websocket streaming
- Explicit allowlists around repositories, branch access, and write operations
- Environment-specific assistant configuration and secret strategy

### What Is Broken or Likely Not Working Correctly

- Approval card flows are likely incomplete end-to-end because the UI expects proposal approval and rejection endpoints that were not verified in the in-repo backend inspected.
- GitHub write/commit flows are likely not self-contained in this repository.
- Assistant UI override flows are likely dependent on external backend state not represented here.
- The displayed current model and connected systems appear largely declarative from the UI side.

### Required Fixes

- Create a dedicated in-repo `assistant-service`
- Define formal request/response contracts for assistant chat, proposals, approvals, GitHub browsing, GitHub write proposals, and UI overrides
- Add auth, audit logs, correlation IDs, and execution history
- Replace fake client-side streaming with real backend streaming
- Add role-based guardrails for agent modes

### Recommended Plan

#### Phase 1
- Create `assistant-service`
- Implement `/health`, `/chat`, `/ui-overrides`, `/change-requests`, `/github/*` read-only endpoints
- Add Azure AI Foundry integration with configuration abstraction

#### Phase 2
- Add proposal persistence and approval workflow tables
- Add signed-in user identity and role checks
- Add telemetry and structured logs

#### Phase 3
- Add controlled write actions for GitHub, UI overrides, and telecom actions
- Add rollback and execution visibility

---

## 2. Knowledge Module

### Current Design Flaws

- The knowledge experience is presented as if it is backed by a real knowledge layer, but the branch still imports local `knowledgeDocuments` and `knowledgeTopics` from mock data in the portal.
- Knowledge UI overrides exist as a concept, but they rely on backend endpoints that are not verified in-repo for this branch.
- There is no clearly visible ingestion, indexing, or relevance pipeline in the inspected repo paths.

### What Is Missing

- Knowledge ingestion pipeline
- Document indexing and retrieval service
- Citation/source display model
- Freshness/version metadata
- Tenant or role scoping for retrieved content
- Admin controls for knowledge lifecycle

### What Is Broken or Likely Not Working Correctly

- “Docs in context” and automatic knowledge attachment are likely partial or externalized.
- The knowledge system appears integrated into the UI, but not yet fully represented in the in-repo backend architecture.

### Required Fixes

- Implement a real knowledge retrieval service
- Create document ingestion + indexing jobs
- Return citations and source metadata to the UI
- Add admin tooling for document sync and retirement

### Recommended Plan

#### Phase 1
- Define knowledge storage schema in Azure SQL or adjacent search index
- Build ingestion and indexing pipeline
- Implement search/retrieve endpoints

#### Phase 2
- Add source metadata, confidence, and freshness info
- Add admin document management UI

#### Phase 3
- Tie assistant answers to grounded knowledge with citations and policy filters

---

## 3. Sales Module

### Current Design Flaws

- The sales workspace remains largely mock-data-driven.
- Lead, opportunity, quote, and customer views are visually mature, but still operate primarily as local-state read models.
- Several actions are still toast-only or modal-only rather than true mutations.
- The branch creates the appearance of a CRM workflow without a verified backend workflow implementation in the repo.

### What Is Missing

- Lead create/update APIs
- Opportunity create/update APIs
- Quote orchestration from live sales records
- Duplicate detection and validation
- Ownership reassignment workflow
- Activity history and audit trail
- Sales assistant actions bound to real state changes

### What Is Broken or Likely Not Working Correctly

- New lead workflow appears incomplete from an end-to-end persistence perspective.
- Quote flows are not fully connected to a live sales service model.
- Sales assistant actions likely generate proposals without guaranteed backend execution in this repo.

### Required Fixes

- Introduce service-backed mutations for leads, opportunities, quotes, and activities
- Model sales workflow as a state machine
- Add audit and ownership history

### Recommended Plan

#### Phase 1
- Build `lead-service` and `opportunity-service`
- Replace modal placeholder actions with real mutations

#### Phase 2
- Add quote orchestration from opportunities into pricing runtime
- Add activity feed and ownership history

#### Phase 3
- Enable assistant-driven sales actions with approval gates where needed

---

## 4. Product & Pricing Module

### Current Design Flaws

- The `fc-gpt` branch improves product/pricing UX substantially, but most of the tabs (pricing, promos, offers, costs, coefficients, performance, billing elements) still appear to be built from client-side derived structures rather than service-backed data.
- The pricing admin surface and the pricing execution/runtime engine are not clearly separated.
- The UI suggests a governed pricing system with rules, coefficients, and approvals, but the verified backend service only covers quote pricing and customer lookup.

### What Is Missing

- Product master service
- Pricing governance/config service
- Effective date/version engine
- Coefficient simulation backend
- Promo/offer lifecycle service
- Billing code management backend
- Approval routing service for pricing changes

### What Is Broken or Likely Not Working Correctly

- Product/pricing admin tabs are likely not live against persistent backend state.
- Pricing governance actions such as add/import/export/simulate are likely incomplete or placeholder-level.
- The portal gives one unified “Product & Pricing” experience, but the backend currently appears split between mock UI logic and a narrower pricing microservice.

### Required Fixes

- Separate runtime quote pricing from administrative pricing governance
- Move all pricing governance data to persistent services/tables
- Implement effective dating, rule simulation, and audit history

### Recommended Plan

#### Phase 1
- Create product catalog and pricing config schemas
- Build read/write APIs for product, billing code, promo, offer, coefficient, and contract tier entities

#### Phase 2
- Integrate quote runtime with governed pricing definitions where appropriate
- Add versioning and approval workflows

#### Phase 3
- Add simulations, rule explanations, and rollback

---

## 5. Customer 360

### Current Design Flaws

- Customer 360 still aggregates mock data from customers, invoices, tickets, orders, and network events within the client.
- The UX is good, but the data composition is not yet anchored to a true backend aggregator.
- Cross-domain context is assembled locally rather than through a central customer context service.

### What Is Missing

- Customer 360 aggregator service
- Unified customer/entity resolution
- Cross-domain read models for sales, billing, service, orders, and network
- Timeline/history persistence
- API-backed customer notes, actions, and relationship graph

### What Is Broken or Likely Not Working Correctly

- Customer 360 likely does not reflect live data changes across systems.
- Related work/actions are mostly presentational.
- 360 context is not yet a real integration hub.

### Required Fixes

- Build a unified customer profile/aggregation layer
- Create read models per account/customer
- Add persistent notes, events, and relationship context

### Recommended Plan

#### Phase 1
- Implement customer identity mapping and 360 read model service
- Replace local aggregations with API-backed composition

#### Phase 2
- Add customer timeline, notes, cross-system links, and assistant-grounded account summaries

---

## 6. Billing Module

### Current Design Flaws

- Billing UI is significantly more complete in presentation than in verified backend connectivity.
- Billing views still appear heavily derived from local invoice/customer structures in the client.
- Billing controls, invoice detail, service instance actions, and adjustments appear UI-first rather than operationally backed.

### What Is Missing

- Billing account service
- Invoice detail and ledger service
- Adjustment and dispute workflow service
- Service instance lifecycle actions
- Billing hierarchy and tax/surcharge logic
- Real export/audit APIs

### What Is Broken or Likely Not Working Correctly

- Activate/disconnect/attach offer/change pricing style actions appear likely placeholder-level.
- Billing detail is not yet a live transactional workspace.
- The pricing microservice customer/account endpoints are real, but the broader billing workspace is not clearly wired to them.

### Required Fixes

- Implement billing read/write services
- Add service-instance and invoice workflows
- Add persistent adjustments and dispute state tracking

### Recommended Plan

#### Phase 1
- Build billing account, invoice, and adjustment APIs
- Replace local client derivation with API responses

#### Phase 2
- Add lifecycle workflows, credits/disputes, and exports
- Connect billing actions to audit history and approval controls

---

## 7. Orders Module

### Current Design Flaws

- Orders have improved structure and lifecycle display in `fc-gpt`, but they remain largely derived in the UI.
- The module models install/modify/disconnect patterns, blockers, SLA state, and dependencies, but a verified backend order orchestration service was not found in the inspected repo.
- The UI implies full order lifecycle support without verified backend ownership of that lifecycle.

### What Is Missing

- Order orchestration service
- Task/dependency engine
- SLA clock and breach computation service
- Provisioning integration layer
- Modify/cancel/reschedule command APIs
- Order event/history store

### What Is Broken or Likely Not Working Correctly

- Modify/cancel/reschedule and downstream orchestration are likely incomplete.
- Order details and lifecycle stages may not be grounded in live backend state.

### Required Fixes

- Create canonical order models and transitions
- Separate order header, line, service, task, and dependency data
- Integrate with provisioning and network systems

### Recommended Plan

#### Phase 1
- Build order service with real persistence and state transitions
- Add task/dependency and SLA computation

#### Phase 2
- Add provisioning and service activation integrations
- Add assistant support for order research and approved changes

---

## 8. Network / Service Management / Provisioning / Carrier Settlement

### Current Design Flaws

- These modules remain dashboard-like and mock-data-based.
- The UI implies operational control, but workflow actions appear mostly presentational.
- No verified network/provisioning/settlement backend was found in the inspected in-repo code.

### What Is Missing

- Event ingestion from NOC/service systems
- Service inventory model
- Provisioning queue and job engine
- Carrier settlement reconciliation service
- SLA impact correlation service
- Persistent workflow/action history

### What Is Broken or Likely Not Working Correctly

- “Advance workflow” style actions are likely placeholders.
- Network impacts, settlement exposure, provisioning status, and catalog watch do not appear fully service-backed.

### Required Fixes

- Build operational services or read models for incidents, inventory, provisioning, and settlement
- Replace dashboard-only behavior with real state transitions and integrations

### Recommended Plan

#### Phase 1
- Create operational data models and ingest services
- Add API-backed queues and detail records

#### Phase 2
- Correlate customer impact, billing exposure, and operational state
- Add assistant-supported root-cause and operational workflow guidance

---

## 9. Reports Module

### Current Design Flaws

- Reports remain local-filter and local-export based.
- The `fc-gpt` branch improves the presentation, but report execution still appears simulated in the client.
- “Run report” behavior does not appear to represent a true service-side execution model.

### What Is Missing

- Report execution service
- Persisted report definitions and permissions
- Service-side pagination
- Async export generation
- Saved filters/parameter presets
- Scheduling support

### What Is Broken or Likely Not Working Correctly

- Live operational reporting is likely not real yet.
- Exports are likely limited to current client-side mock result sets.

### Required Fixes

- Move report definitions and executions to backend services
- Add async export and saved report management

### Recommended Plan

#### Phase 1
- Create report definition + execution APIs
- Back reports with Azure SQL queries/read models

#### Phase 2
- Add exports, permissions, saved views, and schedules

---

## 10. Administration Module

### Current Design Flaws

- Administration is still mostly demo-state UI.
- Users, roles, integrations, audit, and settings are not yet grounded in verified persistent services in this repo.
- Integration health and platform governance are presented, but not backed by a visible in-repo admin service layer.

### What Is Missing

- User directory integration
- RBAC persistence
- Integration registry and health service
- Audit log backend
- Settings/config management service

### What Is Broken or Likely Not Working Correctly

- Invite, system settings, integration status, and audit are likely placeholder-heavy.

### Required Fixes

- Add admin services for identity, roles, integrations, audit, and settings

### Recommended Plan

#### Phase 1
- Add roles/permissions schema and user sync integration
- Build audit log store and integration status model

#### Phase 2
- Add admin controls for platform configuration and governance

---

## 11. GitHub / Dev Agent Workspace

### Current Design Flaws

- The dev workspace is one of the strongest new additions in `fc-gpt`, but it still appears to rely on backend support that is not fully represented in the inspected repo backend.
- Branch browsing, tree browsing, file reading, staging, and proposal rendering exist in the UI, but actual write/commit/PR execution remains dependent on assistant backend endpoints not verified in-repo.
- This creates a strong “looks production ready” surface with uncertain backend depth.

### What Is Missing

- In-repo GitHub backend module implementing branch/tree/file endpoints
- Safe diff generation and patch preview backend
- Commit/branch/PR orchestration endpoint set
- Repo/path allowlisting and write guardrails
- Full execution logging and audit trail

### What Is Broken or Likely Not Working Correctly

- Commit file / commit files workflow is likely incomplete in this repo alone.
- Repository actions likely depend on external service logic not represented here.

### Required Fixes

- Build a dedicated GitHub integration backend module
- Separate read-only repo browsing from write-capable actions
- Enforce path/repository restrictions and approval flows

### Recommended Plan

#### Phase 1
- Implement read-only repo browsing backend
- Add diff and patch proposal generation

#### Phase 2
- Add commit/branch/PR actions behind approval and audit controls

---

## 12. Pricing Microservice

### Current Design Flaws

- This is the most real backend component verified in the repo, but it still has production-readiness issues.
- CORS is too open for production use.
- Error handling in context lookup is too permissive and can hide operational issues.
- Health checks are shallow.
- Documentation around deployment and auth strategy does not fully match the code.
- The service is narrower than the wider portal implies; it does not provide the broader assistant, GitHub, or telecom operations APIs the `fc-gpt` UI now suggests.

### What Is Missing

- Authentication and authorization
- Structured logging and tracing
- Better readiness checks
- Contract tests and integration tests
- Operational telemetry
- Separation between runtime pricing and pricing admin concerns

### What Is Broken or Likely Not Working Correctly

- Production security posture is incomplete.
- Operational troubleshooting will be harder than necessary due to soft exception handling and shallow health status.
- The service is at risk of being treated as a broader backend than it actually is.

### Required Fixes

- Lock down CORS
- Add auth and request identity propagation
- Add structured logs and correlation IDs
- Improve health/readiness checks
- Add tests and schema compatibility validation

### Recommended Plan

#### Phase 1
- Secure the service and add observability
- Add deeper readiness checks

#### Phase 2
- Add tests and stricter error contracts
- Clarify service boundaries vs. other backend modules

---

## Documentation and Deployment Problems

### Current Problems

- Documentation references UI file structures and config patterns that do not match the current React/Vite structure.
- Deployment instructions reference credential/env approaches that do not match the current `DefaultAzureCredential` code path.
- The visible checked-in static web app workflow deploys the `web-ui` from `main`, but there is no clearly matched deployment workflow for the `fc-gpt` assistant/backend architecture in the inspected files.

### Risks

- Onboarding confusion
- Broken or inconsistent deployments
- Incorrect environment configuration
- Harder debugging across branches/environments

### Required Fixes

- Rewrite architecture and deployment docs to match actual code
- Separate docs for:
  - web-ui deployment
  - assistant service deployment
  - pricing microservice deployment
  - shared environment configuration

---

## Highest-Priority Remediation Order

### Priority 1: Define Service Boundaries

Create clear backend ownership for:
- assistant-service
- pricing-microservice
- sales/customer/order/billing services or read models
- shared auth/audit/identity components

### Priority 2: Make the Assistant Backend Real In-Repo

Implement the `/api/assistant/*` contract used by `fc-gpt`.

### Priority 3: Replace Mock Data in Core Modules

Start with:
1. Product & Pricing
2. Sales
3. Billing / Customer 360
4. Orders

### Priority 4: Complete GitHub Dev Workflow

Implement read-only repo APIs first, then guarded write actions.

### Priority 5: Fix Deployment and Environment Separation

Add real preview/staging/prod deployment paths for the UI and assistant service.

### Priority 6: Align Docs to Reality

Rewrite the docs to reflect what the code actually does now.

---

## Suggested Target Architecture

### Web Layer
- `web-ui`
  - React/Vite app
  - No domain mock data in production path
  - UI talks only to approved APIs

### Service Layer
- `assistant-service`
  - Azure AI Foundry integration
  - proposal generation
  - approvals
  - GitHub tools
  - knowledge retrieval
- `pricing-microservice`
  - quote pricing runtime
  - customer lookup
  - quote history / repricing
- domain services / read models
  - sales
  - customer 360
  - billing
  - orders
  - provisioning/network
  - reports
  - administration

### Data Layer
- Azure SQL
  - operational entities
  - read models
  - audit logs
  - assistant conversations
  - proposal state
  - user/role metadata

### Integration Layer
- Azure AI Foundry
- GitHub
- knowledge/indexing backend
- provisioning/network systems
- billing/ledger systems

---

## Final Assessment

The `fc-gpt` branch is strategically strong but architecturally incomplete.

It is already valuable as:
- a high-fidelity product direction branch
- a UX proving ground for the telecom platform
- a strong starting point for an in-product AI workspace

It is not yet fully credible as:
- a complete end-to-end telecom operations platform
- a fully wired Copilot-style GitHub/AI system
- a production-ready architecture without further backend and deployment work

The biggest issue is not the UI quality. The biggest issue is that the branch currently over-represents backend completeness relative to what is verifiably implemented in-repo.

That is fixable, but it requires moving from a UI-first branch to a service-contract-first branch, then replacing mock data systematically with persistent APIs and governed execution paths.
