# Legacy Azure deletion candidates — no deletion authorized

Read-only inventory confirmed these still exist. The owner must approve exact resource IDs and check dependencies/backups before deletion. No Azure resource, image repository, role assignment or branch was deleted in this follow-up.

- Static Web App `bdwus-telecom`: `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.Web/staticSites/bdwus-telecom`
- Legacy Basic registry `bdwuscr` (~$5/month observed September): `/subscriptions/a8f3fd5d-0d2f-4715-b685-728b21d1cc10/resourceGroups/AZURE-SQL-PNG/providers/Microsoft.ContainerRegistry/registries/bdwuscr`. Candidate only if the owner chooses to keep the shared AXIOM registry. If reused as the proposed BDWUS-only registry, retain it. Confirm no remaining image consumers first.

The AXIOM registry/workspace and production SQL database are not deletion candidates. Old Container App `bdwusca`, its old westus2 managed environment, and old logging workspace also require a separate dependency review before any retirement; this document does not approve deleting them.
