# BAR — Open Source Adoption Program

Date: 2026-09-05
Status: SECURITY-SENSITIVE / NO AUTO-MERGE

## Verified current state
BAR is the model-agnostic authority/security runtime around coding agents. Current main already includes one-command `bar work`, adapter diagnostics, read-only evidence UI and hardened governance. PR #19 is separately proving cloud-first development.

## KEEP
- Deterministic controller owns authority.
- Exact candidate/evidence binding.
- Separate Builder/Reviewer.
- Signed Human Gate and replay protection.
- Bounded retries/model calls/wall time.
- No automatic merge/deploy/release side effect.

## ADOPT / IMPLEMENT
1. Skill Permission Contract: allow BAR to consume declarative skill permissions/risk/human-gate metadata without trusting prose.
2. Browser execution adapter: evaluate browser-use as an isolated provider behind a bounded Browser Task Contract; default deny network/domain scope; no credential inheritance.
3. Reconciliation/idempotency contract inspired by Kubernetes for future side-effect adapters.
4. Harness conformance matrix based on Awesome Harness Engineering: context, tools, constraints, sandbox, budgets, verification, telemetry, recovery.
5. Claude Code hook/event mapping for BEFORE_TOOL, AFTER_TOOL, BEFORE_MUTATION, AFTER_MUTATION, AGENT_START/STOP, SESSION_START/END.
6. Curated defensive cybersecurity skill pack for reviewers only; classify APPROVED_DEFENSIVE | REVIEW_REQUIRED | LAB_ONLY | BLOCKED.
7. Go-style structured cancellation/deadline semantics for controller child work where current implementation benefits.
8. Continue Codex/OpenCode/Claude as adapter benchmarks; never inherit their sandbox as BAR's authority boundary.

## REJECT
- No LLM policy engine for protected authority.
- No direct agent GitHub credentials.
- No unrestricted browser/network capability.
- No auto-install of remote skills.
- No OpenViking/AgentMemory as trusted evidence source.

## Required gates
Every dependency/adapter must pin upstream version/commit, record license, define capability/authority separation, run negative tests, prove fail-closed behavior, and preserve current Human Gate semantics.