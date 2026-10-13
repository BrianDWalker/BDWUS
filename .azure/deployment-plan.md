# BDWUS deployment preparation

Status: Analysis in progress; deployment prohibited until owner approval.

## Scope
Modernize the existing portal using Container Apps, Entra authentication, managed
identity, Key Vault, Bicep and azd. Preserve AZBDWUSP and existing local UI edits.

## Proposed layout
One portal app serves React and the existing FastAPI API under /api. Retain a
separate assistant service only if the current code requires it. Reuse AXIOM's
registry and Log Analytics workspace by resource ID. Separate dev/prod settings.

## Approval gates
No Azure creation, modification, deletion, provision or deployment. No database
schema application. Present SQL and deployment commands for owner review first.

## Discovery and validation
Repository and Azure read-only inventory pending. Shared resource IDs, SQL tier,
costs, authentication settings, and AXIOM template availability pending.
