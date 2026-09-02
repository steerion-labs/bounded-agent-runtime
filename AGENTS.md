# Steerion Labs Bounded Agent Runtime — Engineering Contract

## Roles
- ChatGPT: Architect / Orchestrator / QA.
- OpenCode + NVIDIA NIM: primary bounded builder; model selected per task.
- Desktop Commander: local execution, tests, diffs, Windows/Docker validation.
- Codex: independent review and deep-debug escalation.
- GitHub: source of truth for branches, commits, PRs, issues and evidence.
- Vebi: Human Decision Owner for merge, release, GO and authority expansion.

## Work loop
1. Resolve exact branch/head and dirty state.
2. Define ALLOWED / FORBIDDEN / CHANGE / FAIL IF / CHECKS / OUTPUT.
3. OpenCode builds only the bounded task.
4. Commander runs targeted checks and runtime validation.
5. Codex independently reviews STANDARD/DEEP changes.
6. Builder fixes findings; repeat until PASS.
7. Record evidence and request Human Gate where required.

## Hard boundaries
- Preserve bounded-agent authority and fail closed on ambiguity.
- No secrets or productive credentials.
- No unattended authority expansion.
- No automatic merge, release, deploy or GO.
- No GitHub Actions changes unless separately approved.
- Security, approval binding, fencing, recovery and idempotency changes require independent review.
- Prefer targeted tests and smallest sufficient context.

## Current coordination
Use the repository issue titled `AI Engineering Control Loop — OpenCode/NVIDIA + Commander + Independent Review` as the live task/handoff thread.
