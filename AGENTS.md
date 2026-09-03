# Steerion Labs Bounded Agent Runtime — Engineering Contract

## Roles
- Architect / Orchestrator: defines bounded tasks, acceptance criteria and required evidence.
- Builder: an explicitly selected agent adapter executes only the approved task scope.
- Execution / QA: local or cloud tooling runs diffs, tests and host-specific validation.
- Independent Reviewer: reviews STANDARD/DEEP changes from a separate context.
- GitHub: source of truth for branches, commits, pull requests, issues and canonical evidence.
- Human Decision Owner: required for merge, release, GO and any authority expansion.

## Work loop
1. Resolve exact repository, branch, HEAD and dirty state.
2. Define ALLOWED / FORBIDDEN / CHANGE / FAIL IF / CHECKS / OUTPUT.
3. Select a role-safe Builder and execute only the bounded task.
4. Run targeted checks plus required runtime or host-specific validation.
5. Independently review STANDARD/DEEP changes.
6. Fix findings and repeat until the exact candidate is green.
7. Record exact-head evidence and request Human Gate where required.

## Hard boundaries
- Preserve bounded-agent authority and fail closed on ambiguity.
- No secrets or production credentials in repository content or worker context.
- No unattended authority expansion.
- No automatic merge, release, deploy or GO.
- No automatic GitHub Actions triggers merely for convenience; use local/cloud proof first and manual gates only when justified.
- Security, approval binding, fencing, recovery and idempotency changes require independent review.
- Evidence is stale when the candidate HEAD changes.
- Prefer targeted tests and the smallest sufficient context.

## Current coordination
Use issue #16 as the canonical engineering-control-loop thread. Repository state and accepted `main` override stale task text or local notes.
