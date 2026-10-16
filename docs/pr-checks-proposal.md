# One required PR job — proposal

Proposed check context: **Portal checks** from .github/workflows/portal-checks.yml. One Linux job runs Ruff, ESLint, pytest (mocked SQL; credentials forbidden) and Vite build, with Python/npm caches. No Azure login, OIDC permission, deployment, browser suite or path filters; documentation-only PRs receive the same status. Superseded PR runs cancel. Target warm runtime under 3 minutes; timeout 5 minutes allows a cold dependency download without pretending the target is measured. The first PR run measures it.

At 20 PRs/month with 2 runs each, estimate 80–120 runner minutes/month (2–3 minutes/run). At 100 runs, 200–300 minutes. GitHub rounds each job to whole minutes; this is workload planning, not a guarantee. Current repository visibility is public, so standard hosted runner use is free under GitHub's public-repository allowance. Reassess if it becomes private. No duplicate push check and no test matrix.

After the owner approves: merge this workflow, require the observed Portal checks context on main, keep PRs required, and enable dismissal of stale approvals/requiring the latest reviewed head as appropriate. Do not enable branch protection here. Codex review remains a separate human-reviewed merge gate: request it on every final head, wait for completion, fix/answer every finding and re-request after meaningful fixes. A green build is not a completed Codex review.

Source: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
