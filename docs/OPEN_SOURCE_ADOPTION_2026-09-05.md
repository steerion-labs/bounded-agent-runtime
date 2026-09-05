# BAR — Open Source Adoption Program

Date: 2026-09-06
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

## ECC candidate — affaan-m/ECC

### Verified source pin
- Upstream: `affaan-m/ECC`.
- Evaluated `main`: `e04ea0b9cc8248686edf5ac751cadff550e162b8`.
- License: MIT per upstream README.
- Upstream positions ECC as an agent-harness engineering system spanning planning, testing, implementation, fresh-context review, verification, persistent memory and continuous learning.
- Current upstream README exposes a large catalogue of agents, skills, command shims, hooks/rules, memory and AgentShield security scanning across Claude Code, Codex and other harnesses.

### BAR comparison
ECC is strongest as an engineering-process and reusable-capability layer. BAR remains stronger as the authority/evidence kernel.

| Dimension | BAR | ECC | Decision |
|---|---|---|---|
| Authority model | Deterministic controller, explicit task envelope | Harness/process configuration around host agent | KEEP BAR |
| Exact candidate binding | SHA/tree-bound controller evidence | Verification/review workflows, not BAR-equivalent authority binding | KEEP BAR |
| Builder/Reviewer separation | Security invariant | Specialized planning/review agents | ADOPT role patterns behind BAR |
| Human Gate | Explicit protected-action gate | Workflow/checkpoint oriented | KEEP BAR |
| Skills | Capability intake is deny-by-default | Very broad curated skill catalogue | ADOPT via Skill Permission Contract only |
| Hooks | BAR events are security-relevant boundaries | Rich hook-driven workflow automation | ADOPT mapped events, never implicit authority |
| Memory | Evidence/state is controller-owned and narrow | Persistent memory + session learning | ADOPT only as untrusted advisory context |
| Continuous learning | Improvement Observer proposes only | Repeated wins can become reusable skills/patterns | ADOPT proposal-only pipeline |
| Security scanning | Runtime/authority hardening | AgentShield scans prompts/hooks/MCP/permissions/secrets/agent files | EVALUATE as reviewer/security input |
| Multi-harness support | Explicit adapters | Broad harness support | USE as conformance benchmark |

### ECC adoption slices
1. `ECC-1 Hook Contract`: map ECC-style lifecycle hooks into typed BAR observer events. Hooks may observe/propose; protected mutation still requires BAR authority.
2. `ECC-2 Skill Intake`: import selected ECC skills only through pinned source + license + declarative permissions + risk tier + negative tests.
3. `ECC-3 Fresh Context Review`: formalize an independent fresh-context review adapter as an optional reviewer strategy while preserving separate identity and exact-head binding.
4. `ECC-4 Learning Intake`: convert learned patterns/instincts into Improvement Observer proposals; never auto-promote to runtime authority.
5. `ECC-5 AgentShield Evaluation`: test AgentShield as a read-only scanner whose output is evidence input, never an authorization decision.

### ECC reject list
- No bulk installation of the full skill/agent catalogue into BAR runtime.
- No hook may expand scope, credentials, network access or protected actions.
- No remembered/learned pattern may become trusted evidence or policy by itself.
- No host-harness permission model replaces BAR controller authority.

## Ruflo candidate — ruflo-app/ruflo

### Verified source pin
- Upstream evaluated: `ruflo-app/ruflo`.
- Evaluated `main`: `cc51af981ef1d6e41dd94b821356f4e1946a6d24`.
- License: MIT per upstream README.
- Ruflo positions itself as a meta-harness around Claude Code/Codex with specialized agents, swarms, persistent/vector memory, learning, workflows, background workers, provider routing, browser/testing plugins, federation, observability and security plugins.

### BAR comparison
Ruflo is much broader than BAR and is strongest in orchestration, memory, swarm coordination and extensibility. That breadth is useful, but it also creates a larger authority and attack surface than BAR should inherit directly.

| Dimension | BAR | Ruflo | Decision |
|---|---|---|---|
| Core purpose | Bounded secure execution kernel | Broad agent meta-harness/orchestration platform | COMPLEMENT, not replace |
| Swarms | Deliberately narrow Builder/Reviewer model | Hierarchical/mesh/adaptive swarms | LAB evaluation behind controller |
| Memory | Controller state/evidence, no trust from memory | Vector memory, RAG, graph memory, saved trajectories | ADOPT advisory memory boundary |
| Learning | Proposal-only improvement | Self-learning/trajectory patterns | ADOPT proposal-only concepts |
| Background work | Explicit bounded task execution | Auto-triggered/background workers | REJECT automatic authority; evaluate scheduled proposals only |
| Workflows | `bar work` bounded one-command path | Reusable multi-step workflows + goal planner | ADOPT declarative plan format with bounded step contracts |
| Provider routing | Boundary provider registry + policy hash | Multi-provider smart routing/failover | BENCHMARK only; BAR keeps policy authority |
| Browser | Not yet general-purpose runtime authority | Playwright/browser plugin | EVALUATE as isolated adapter |
| Federation | No cross-machine trust fabric in core | Zero-trust cross-agent federation | FUTURE LAB candidate, not v0.5 core |
| Observability/cost | Evidence-first audit | Logs, traces, metrics, cost tracking | ADOPT read-only telemetry ideas |
| Security | Fail-closed authority/evidence kernel | Security/audit/AIDefence plugins | EVALUATE as defensive inputs |

### Ruflo adoption slices
1. `RUFLO-1 Plan DAG`: evaluate a declarative goal/plan DAG that decomposes `bar work` into bounded child tasks. Every node receives its own authority envelope, budget and verification requirement.
2. `RUFLO-2 Swarm Lab`: prototype multi-agent coordination only inside a parent BAR task, with explicit max agents, max calls, wall time and no scope union beyond the parent envelope.
3. `RUFLO-3 Advisory Memory`: define a memory adapter contract where retrieved memory is labelled UNTRUSTED_CONTEXT and cannot satisfy evidence/approval requirements.
4. `RUFLO-4 Telemetry`: adopt token/cost/runtime counters and structured agent lifecycle telemetry into read-only evidence views.
5. `RUFLO-5 Browser Adapter`: benchmark Ruflo browser/Playwright patterns against BAR's planned Browser Task Contract.
6. `RUFLO-6 Federation Research`: document requirements for future remote-agent identity, transport and trust without enabling federation in runtime.

### Ruflo reject list
- No direct enablement of autonomous loops/background workers with BAR credentials or protected project authority.
- No swarm consensus can authorize protected actions.
- No memory/vector/RAG result is trusted evidence.
- No provider failover after execution binding unless BAR explicitly re-plans and re-binds a new candidate.
- No federation, daemon or plugin marketplace gains default runtime authority.

## ECC vs Ruflo vs BAR — overall judgement

| Capability | BAR | ECC | Ruflo |
|---|---|---|---|
| Authority/security kernel | BEST FIT | SUPPORTING | SUPPORTING |
| Exact-head evidence | BEST FIT | PARTIAL/PROCESS | PARTIAL/PLATFORM |
| Human protected-action gate | BEST FIT | PROCESS LEVEL | PLATFORM LEVEL |
| Engineering workflow | GOOD | BEST FIT | VERY GOOD |
| Skills/agent catalogue | CONTROLLED/SMALL | BEST FIT | VERY BROAD |
| Swarm orchestration | LIMITED BY DESIGN | MODERATE | BEST FIT |
| Persistent memory | LIMITED BY DESIGN | STRONG | BEST FIT |
| Continuous learning | PROPOSAL ONLY | STRONG | VERY STRONG |
| Multi-provider orchestration | CONTROLLED | HARNESS-DEPENDENT | STRONG |
| Browser/testing ecosystem | CONTROLLED/PLANNED | SKILL-DRIVEN | STRONG |
| Federation | OUT OF CORE | OUT OF CORE | STRONG |
| Safe foundation for Steerion | YES | YES, behind BAR | YES, behind BAR |

Conclusion: BAR should remain the immutable authority/evidence kernel. ECC should feed the engineering-process, skill, hook, review and learning layers. Ruflo should feed orchestration, plan-DAG, memory, telemetry, browser and future swarm/federation research. Neither upstream is granted direct runtime authority.

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

For ECC and Ruflo specifically, the first implementation phase is contract-level adoption and isolated POCs only. Installing either full framework or enabling autonomous/background/federated execution requires a separate explicit Human Accept after dependency, credential, network, update-channel and rollback review.