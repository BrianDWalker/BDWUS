# Portal assistant controls

The portal assistant is separate from the removed legacy assistant-service. Chat can store conversation messages and propose lead creation, UI overrides or GitHub updates. Operational roles may chat; only Admin can approve/reject proposals. All repository reads and writes must name an entry in ASSISTANT_ALLOWED_REPOSITORIES (comma-separated owner/repo; empty denies everything).

GitHub commits default OFF. Enabling ASSISTANT_GITHUB_WRITES_ENABLED=true additionally requires ASSISTANT_OWNER_OBJECT_ID to match the signed-in Entra owner object ID. Admin alone is insufficient. No live setting or token was enabled in this follow-up.

When enabled, approved GitHub proposals can create/replace the full contents of named files in an allowed repository, create Git blobs/trees/commits, and advance the chosen existing branch without force. This can change application code, configuration and workflows and can trigger that branch's existing automation. It does not create PRs or provide a sandbox. Branch protections and the token's permissions still apply. Prefer keeping it disabled; deciding whether to enable it is an owner decision.

Approval atomically changes Proposed to Applying before any effect. A completed retry returns the existing result; a concurrent/uncertain retry is refused. If the process or an external call fails after claiming, it stays Applying for manual reconciliation. Do not reset it to Proposed without checking whether the lead/commit already exists. This is an at-most-once execution policy, not an exactly-once distributed transaction.
