# One required PR job — enabled 16 October 2026

Required check context: **Portal checks** from .github/workflows/portal-checks.yml. One Linux job runs Ruff, ESLint, pytest (mocked SQL; credentials forbidden) and Vite build, with Python/npm caches. No Azure login, OIDC permission, deployment, browser suite or path filters; documentation-only PRs receive the same status. Superseded PR runs cancel. Target warm runtime under 3 minutes; timeout 5 minutes allows a cold dependency download without pretending the target is measured. Hosted runs measured 26–49 seconds during this rollout.

At 20 PRs/month with 2 runs each, estimate 80–120 runner minutes/month (2–3 minutes/run). At 100 runs, 200–300 minutes. GitHub rounds each job to whole minutes; this is workload planning, not a guarantee. Current repository visibility is public, so standard hosted runner use is free under GitHub's public-repository allowance. Reassess if it becomes private. No duplicate push check and no test matrix.

The owner approved the workflow and required Portal checks context on main. PRs remain required and existing review, force-push and deletion protections were retained. Codex review remains a separate human-reviewed merge gate: request it on every final head, wait for completion, fix/answer every finding and re-request after meaningful fixes. A green build is not a completed Codex review.

Source: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).


Owner approved and enabled Portal checks as a required GitHub Actions check on main on 16 October 2026. Hosted validations passed within the under-three-minute target. Existing PR/force-push/deletion policies were retained. Stacked PRs were checked at their exact heads and applicable merge checks before merging; completed Codex reviews and finding dispositions were verified separately.
