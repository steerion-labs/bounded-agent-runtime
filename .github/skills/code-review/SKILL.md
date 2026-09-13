---
name: code-review
description: Use for every pull request code review. Apply the BAR Steerion SDLC gate and exact-head security evidence rules.
---

# BAR Code Review

For every review:

1. Read `.github/skills/steerion-sdlc-gate/SKILL.md`, `.steerion/sdlc-gate.json`, `.steerion/agent-system.json`, and repository instructions.
2. Bind findings to the exact PR head and actual changed files.
3. Prioritize authority, credential isolation, fencing, recovery, fail-closed behavior, dependency risk, correctness and regression risk.
4. Require deterministic evidence for release claims. AI review is never sufficient release proof.
5. Treat missing required evidence as `BLOCKED` and confirmed security/release blockers as `NO-GO`.
6. Never authorize merge, deploy, release, credentials, authority expansion, spend or third-party installation. Human Gate remains mandatory.

Return concise findings with severity, evidence and the smallest safe remediation.
