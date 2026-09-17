# PROJECT_STATE

Last sync: 2026-09-17 Europe/Zurich
Project: Bounded Agent Runtime (BAR)
Portfolio control plane: GitHub Project #2 `Vebi Project Control Plane`
Technical source of truth: this repository and exact-head GitHub evidence
Responsibility: execution boundary

## Status
REVIEW / ACTIVE

Current `main`: `cc45bfeed0a1f8480a1e969701e77c75998713b0`
Open PRs at reconciliation: #59, #58, #50, #49, #48, #46, #45.
Open issues: 6.

Current selected WIP is PR #59 at exact head `1d6062244614997470df866f143502534a6c529d`.
GitHub CI and CodeQL are PASS on that exact head. The PR is mergeable. A fresh independent Windows reproof was started and currently remains unresolved because the local test run hangs in CLI/integration/work-request tests. Therefore PR #59 is REVIEW_REQUIRED, not PASS.

## Boundaries
BAR is the bounded authority and evidence kernel. It must not become the Company brain, business planner or portfolio orchestrator.

Model output, memory, plugins, MCP tools, external frameworks and reviewer opinions never grant authority by themselves.

Protected actions require the existing authority, credential isolation, role separation, exact candidate/tree binding, fencing, recovery and Human Gate controls. No automatic merge, deploy, release, spend, productive mutation or authority expansion is authorized.

## Next
1. Isolate the exact-head Windows test hang on PR #59.
2. Fix a proven defect or classify a host/test-harness issue with evidence.
3. Re-run exact-head verification and independent review.
4. Stop at Human Gate before merge.
5. Keep failed Dependabot PRs #49/#50 separate from the selected PR #59 outcome.
