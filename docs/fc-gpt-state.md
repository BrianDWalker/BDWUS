# fc-gpt State

Current code state:
- Major routes are extracted.
- Legacy route ownership is empty.
- Customer Service tickets are persistent.
- Quote to order creates an Ops order.
- Dashboard and Knowledge are extracted and hardened.
- Frontend role gating covers care, billing, sales, orders, and provisioning.
- Care storage is part of readiness.

Needs outside proof:
- CI pass.
- Azure Container Apps deployment.
- Live Azure SQL behavior.
- Browser visual QA.

Future work:
- Server-side authorization.
- API-backed Knowledge documents.
- Formal quote to order audit lineage.
- Production monitoring and rollback notes.
