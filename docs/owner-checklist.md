# Owner checklist — 15 October 2026

The initial rollout is live. These follow-up PRs are open, not deployed. No Azure changes, resource/branch deletions, production data writes or branch-protection updates were made. Follow this order; already-completed items are verification, not instructions to recreate them.

1. **First Entra sign-in with MFA:** sign into dev and production using your work account and complete any tenant-required MFA. You already reported initial dev sign-in worked; independently checking your tenant's MFA enforcement is outside this inventory. Confirm the portal opens with the intended role. Do not send credentials to Codex.
2. **Assignment required:** in Entra Enterprise applications for each BDWUS app, confirm Properties → Assignment required = Yes. This setting is on the enterprise application's service principal, rather than the app registration's Web settings. Live checks show Yes for both; no change needed unless it drifts.
3. **Assign users and roles:** use Users and groups → Add assignment; assign only intended users and an explicit Viewer/Executive/Sales/Care/Billing/Ops/Admin role. Your initial owner Admin assignments were configured during rollout. Missing/unrecognized roles grant Viewer capabilities. Additional assignments are your decision; application admin.Users records do not grant Entra sign-in.
4. **Production environment reviewer:** in GitHub repository Settings → Environments → prod, verify BrianDWalker is the sole required reviewer and deployment branches allow only main. Live state matches. Self-review prevention is off (the sole owner may dispatch then approve); administrators can currently bypass. Decide separately if you want to disallow administrative bypass; do not mistake CI or chat approval for a new environment-policy change.
5. **Deployment enablement:** repository variable BDWUS_DEPLOY_APPROVED is already true. Keep the flag consistent with your deployment intent. Main pushes matching app paths deploy dev automatically; production dispatch still requires its environment review. Approve a specific release list before these follow-up PRs merge; do not merge app PRs under the current no-Azure-change instruction.
6. **Delete obsolete repository secrets yourself after checking stale workflows:** the current OIDC workflow uses none of the five secrets below. Check retained branches/workflows and then approve/delete exactly the obsolete entries in Settings → Secrets and variables → Actions. Values were never retrieved. No dev/prod environment secrets are present.

- `AZUREAPPSERVICE_PUBLISHPROFILE_4ADFC1BCE9154456897BB18C8E6AC96E`
- `AZUREAPPSERVICE_PUBLISHPROFILE_E8F52B3F28394382890763BC52502A91`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_POLITE_CLIFF_080B22C0F`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_SKY_0B99DC10F`

7. **CI decision:** approve the single Portal checks job and making it required on main. The first hosted run succeeded in 35 seconds. Current main has no required status checks; branch protection was not changed. Target under 3 minutes, planning 80–120 minutes/month for 40 runs. Require completed Codex review of each final head and resolve/answer findings before any merge.
8. **Registry/role decision:** review PR #25 and its permission proposal. Choose dedicated BDWUS registry or coordinated shared ABAC migration, approve exact new roles, cutover and old grant removals. Existing bdwuscr reuse also requires an approved ABAC migration. No role/mode change has been applied.
9. **Quote SQL and app release:** review the additive quote_order_association_proposal.sql in PR #24. Approve the one nullable SourceQuoteId column and unique filtered index in dev/prod, then approve application rollout in PR order #21 → #22 → #23 → #24 only after completed reviews. Do not deploy quote conversion before its SQL prerequisite. Production application rollout remains manual with GitHub review.
10. **Billing demo-data decision:** review billing-demo-data-proposal.md and its exact JSON manifest. Approve a dev rehearsal first and separately four production inserts (1 subscription, 1 demo payment, 2 usage events). Nothing has been loaded and the existing seeder still refuses prod. ms.vPricingContext remains synthetic.
11. **Retirement decisions:** approve exact Azure resource IDs from legacy-resource-candidates.md and exact branch names/tips from branch-retirement-review.md. Keep unique-work branches until you decide what to preserve. If bdwuscr is reused, retain it. No Azure resource or branch deletion is authorized or scheduled.

See live-state-review.md for observed settings, evidence and read-only recheck commands. All follow-up PRs remain open pending applicable approvals; do not merge merely because a review request was sent.
