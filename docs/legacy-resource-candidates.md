# Legacy Azure resources — approved retirement outcome

The owner approved the specific retirement list on 16 October. The Static Web App below is deleted; bdwuscr is retained and actively used. Original resource IDs are retained for the audit trail.

- Deleted Static Web App `bdwus-telecom`: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.Web/staticSites/bdwus-telecom`
- Legacy Basic registry `bdwuscr` (~$5/month observed September): `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.ContainerRegistry/registries/bdwuscr`. Retained as the active BDWUS-only registry; it also serves the retained old BDWUS app. It is no longer a deletion candidate.

The AXIOM registry/workspace and production SQL database are not deletion candidates. Old Container App `bdwusca`, its old westus2 managed environment, and old logging workspace also require a separate dependency review before any retirement; this document does not approve deleting them.


## Owner-approved outcome — 16 October 2026

Deleted only bdwus-telecom after verifying live Container Apps and no linked SWA backend. Retained/reused bdwuscr as the active BDWUS registry, so it is no longer a deletion candidate. The old bdwusca app, West US 2 environment and old logging workspace remain. AXIOM registry configuration remains unchanged.
