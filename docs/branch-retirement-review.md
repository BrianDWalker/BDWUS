# Branch retirement review — 15 October 2026

Historical approval baseline: origin/main at c227fd9057df6d2acb66070869552cab82c328bc. Owner approved the listed candidates on 16 October. Thirteen were deleted after exact-tip and ancestry rechecks; BDWUS_SITE, backup-web-ui-before-platform-upgrade and feature-web-ui-platform-upgrade were already absent. Unique-work branches were retained. Evidence uses `git merge-base --is-ancestor`, `git rev-list --count origin/main..origin/<branch>` and `git cherry origin/main origin/<branch>`. Recheck current heads immediately before any owner-approved deletion; a later push invalidates this snapshot. Preserve main and all open follow-up PR branches.

## Safe candidates: fully contained in main

Every branch below is an ancestor of main and has zero commits ahead / zero unique patches. Its tip and history remain reachable through main.

| Branch | Tip | Evidence |
| --- | --- | --- |
| BDWUS_SITE | `0f478c7b1b19` | ancestor; ahead 0; unique patches 0 |
| backup | `03b726e7b831` | ancestor; ahead 0; unique patches 0 |
| backup-web-ui-before-platform-upgrade | `c0673d8c78cd` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-01-cleanup | `e8f4900daaf6` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-02-infrastructure | `2ab6b40c25b7` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-03-hosting | `3ba414aa77ab` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-04-entra | `2f666016c200` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-05-sql-ui | `369a4a8c40ce` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-06-secrets | `8a7e81850e7b` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-07-checks-docs | `cef980f45745` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-approved-rollout | `eb2c4c8048b9` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-release-main | `a311944b6230` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-rollout-complete | `2803e4442411` | ancestor; ahead 0; unique patches 0 |
| codex/bdwus-rollout-validation | `459b790fdd86` | ancestor; ahead 0; unique patches 0 |
| feature-change | `9771f09aa4ff` | ancestor; ahead 0; unique patches 0 |
| feature-web-ui-platform-upgrade | `512f6a6bcc48` | ancestor; ahead 0; unique patches 0 |

`fc-gpt` has no unique non-merge patches, but has eight distinct merge commits and an older configuration tree. Keep it for now rather than discard its merge history without an explicit owner decision; no application patch needs rescuing.

## Keep: unique or pending work

| Branch | Ahead / unique patches | Work to preserve or decide |
| --- | --- | --- |
| codex/bdwus-assistant-boundaries | 6 / 5 | 44192c03 Deny unclassified API routes and derive audit actors from authenticated identity; a21f6e45 Restrict assistant repositories and owner commits and claim approvals atomically; 47ae6b6d Format assistant security regression tests; b4011799 Address Codex review: local API tokens, CORS preflights and requester preservation; 4653b5bb Validate assistant payloads before claim and preserve note approvals |
| codex/bdwus-authorization-hardening | 2 / 2 | 44192c03 Deny unclassified API routes and derive audit actors from authenticated identity; b4011799 Address Codex review: local API tokens, CORS preflights and requester preservation |
| codex/bdwus-deployment-permissions | 2 / 2 | ac98bbbc Propose repository-scoped registry access and narrow portal deployment roles; 7a70cfe4 Use the stable registry API supporting ABAC mode |
| codex/bdwus-lean-pr-checks | 1 / 1 | 60bc2af7 Propose one cached PR quality job without changing branch protection |
| codex/bdwus-legacy-cleanup | 2 / 2 | 14da8e36 Remove unauthenticated legacy service and obsolete SWA and handoff artifacts; abd69784 Clarify completed deployment policy and historical commands |
| codex/bdwus-quote-order-idempotency | 5 / 5 | 44192c03 Deny unclassified API routes and derive audit actors from authenticated identity; a21f6e45 Restrict assistant repositories and owner commits and claim approvals atomically; 47ae6b6d Format assistant security regression tests; 47a3e545 Disable test support by default and refuse unsafe Azure authentication startup; b85d8b0e Persist one order per quote and save from the Create Order modal |
| codex/bdwus-safe-runtime-defaults | 4 / 4 | 44192c03 Deny unclassified API routes and derive audit actors from authenticated identity; a21f6e45 Restrict assistant repositories and owner commits and claim approvals atomically; 47ae6b6d Format assistant security regression tests; 47a3e545 Disable test support by default and refuse unsafe Azure authentication startup |
| copilot/investigate-azure-static-web-app-error | 4 / 3 | aa240fdb Fix SWA fallback and add robots policy; f918bb66 Refine static fallback excludes; 5567dad7 Simplify robots policy |
| dependabot/docker/docker-e863dd4528 | 1 / 1 | 60a327f6 Bump the docker group across 3 directories with 2 updates |
| dependabot/github_actions/actions-67790409b3 | 1 / 1 | 32275b9d Bump the actions group with 2 updates |
| dependabot/npm_and_yarn/web-ui/npm-0037ccfbf8 | 1 / 1 | 67162f23 Bump the npm group in /web-ui with 6 updates |
| dependabot/pip/assistant-service/python-d04003db03 | 1 / 1 | b5750393 Update openai requirement |
| fc-gpt | 8 / 0 | Distinct merge history; no unique individual patches |
| fc-gpt-deep-review-audit | 8 / 5 | b4cbc3e8 Add deep review audit static web preview; 15325847 Point preview Static Web App to deep review audit; 40c25745 Redeploy preview environment from audit branch; 97f94d2d Use CLI deploy for audit preview environment; 24eda8c7 Auto-deploy pricing service to Azure Container Apps |

`fc-gpt-deep-review-audit` uniquely contains static-web preview wiring, preview branch targeting/redeployment and CLI deployment, plus an automatic pricing-service Container Apps workflow. `copilot/investigate-azure-static-web-app-error` uniquely changes SPA fallback exclusions and robots policy. Keep both until the owner decides whether those historical fixes matter. The closed Dependabot #16 branch still has its unique dependency patch; closure did not delete it.

Old push-trigger workflows remain in backup, feature-change, BDWUS_SITE, backup-web-ui-before-platform-upgrade, feature-web-ui-platform-upgrade, fc-gpt-deep-review-audit and the Copilot investigation branch. The first five are ancestor candidates above; the latter two contain unique work and are retained. Do not push to these stale branches while old deployment workflows/secrets remain. Removing files on main does not rewrite those branches.

The exact listed candidates are now absent remotely. This historical evidence table preserves their approved tips; their history remains reachable from main. New follow-up branches are retained.
