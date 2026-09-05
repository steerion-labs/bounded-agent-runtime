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

## Approved pinned skill — diagram-design
- Decision: SKILL.
- Source: `cathrynlavery/diagram-design`.
- Upstream version-2.0 source verified 2026-09-05 at commit `ced802198d622cfe544fbc1d2b5452e038a5f55f`; current upstream HEAD `4451eadc484d76aa860edf3289c16fcd082dcdbf` reports skill metadata 2.6 and is excluded from this approved pin.
- Skill: `diagram-design`.
- Skill metadata version: `2.0`.
- License: MIT.
- Install scope: repo-/agent-specific documentation/reviewer capability only; not global.
- Authority: NONE. Skill metadata is untrusted input and may never broaden the BAR task authority envelope.
- Status: `INSTALLED_LOCAL_POC` - repo-local `.claude/skills/diagram-design` installed at exact 2.0/MIT source pin; metadata/load and harmless bundled architecture-fixture presence smoke PASS. No BAR runtime or authority path changed; DEEP exact-head review remains open.
- Host-return checks: install from pinned source, discovery/load smoke, harmless fixture diagram, verify capability requests remain bounded by the Skill-Permission Contract, no browser/network/credential authority, `git diff --check`, targeted negatives, independent DEEP exact-head review.
- Rollback: remove the repo-specific skill reference/files; no runtime authority migration involved.

## REJECT
- No LLM policy engine for protected authority.
- No direct agent GitHub credentials.
- No unrestricted browser/network capability.
- No auto-install of remote skills.
- No OpenViking/AgentMemory as trusted evidence source.

## Required gates
Every dependency/adapter must pin upstream version/commit, record license, define capability/authority separation, run negative tests, prove fail-closed behavior, and preserve current Human Gate semantics.