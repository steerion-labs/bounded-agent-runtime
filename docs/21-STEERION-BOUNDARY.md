# Steerion Boundary

Steerion Boundary is the composition layer for safe autonomous work. It sits above the Bounded Agent Runtime (BAR) and keeps capability selection, authority, routing and promotion policy deterministic and outside model control.

**Boundary is not a second agent. It is the control plane around agents.**

BAR remains the runtime/security kernel for exact candidate identity, controller-owned evidence, reviewer separation, budgets, recovery and Human Gate enforcement.

## Core invariant

No model, tool, plugin, skill or external repository receives authority merely because it is available.

A task may use a capability only when:
1. the capability exists in the registry,
2. the task explicitly grants it,
3. the action and role are allowed,
4. the selected adapter is ready and policy-compatible,
5. required verification evidence exists,
6. protected effects reach the Human Gate.

Unknown capability, unknown action, unsafe routing or binding drift fails closed.

## v0.1 modules

- `capability-registry.mjs`: typed capability contracts
- `authority-engine.mjs`: deterministic `ALLOW_LOCAL`, `HUMAN_GATE_REQUIRED`, `DENY`
- `agent-router.mjs`: pre-execution adapter selection
- `provider-router.mjs`: data-class-aware provider selection- `binding.mjs`: exact task/capability/action/role/adapter/provider binding
- `execution-planner.mjs`: non-executable plans while Human Gate is pending
- `improvement-observer.mjs`: observe and propose, never self-modify
- `skill-intake.mjs`: discovered skills enter Labs review, never direct promotion

## Routing rules

Agent routing happens once before execution. Installation alone is insufficient. Known authentication state, role safety, declared capability compatibility and readiness are considered before selection.

The selected adapter is bound into the execution identity. A later adapter change is a new decision and must not be treated as a silent fallback.

Provider routing follows the same rule. Data classification is part of eligibility. A cheaper or free provider is never allowed to receive a data class that policy does not permit.

## Controlled improvement loop

```text
Task execution
  -> observation
  -> improvement proposal
  -> Labs intake
  -> dependency/security review
  -> sandbox test
  -> independent review
  -> promotion gate
  -> capability registry
```

The observer has no authority to edit policy, install skills or promote its own proposal.

## External technology intakeThe following projects are evaluation candidates, not trusted dependencies:

| Candidate | Boundary question |
|---|---|
| Superpowers | Which planning, debugging and verification patterns improve agent work without gaining authority? |
| Task Observer | Which observations should become reviewable improvement proposals? |
| find-skills / skills.sh | How can capability gaps discover candidates without auto-installing them? |
| Playwright skills | Which browser actions can be split into read/test/prepare/protected-submit capabilities? |
| Obsidian Second Brain | Which durable knowledge should be human-readable and locally governed? |
| claude-mem | Which observation/compression/retrieval patterns are useful without inheriting uncontrolled hooks or MCPs? |
| Caveman Mode | Where can communication be compressed without weakening evidence or security findings? |
| Free LLM provider catalogs | How can cost routing remain data-class and policy constrained? |
| CLI-Anything | Which CLI harness patterns improve bounded tool integration? |
| AgenticSeek | Which autonomy patterns survive adversarial review? |
| Open WebUI | Which operator-surface patterns help inspect runs and evidence? |
| Vane | Which research/RAG capabilities meet source-quality and isolation requirements? |
| ComfyUI | Can media generation operate as an isolated capability service? |

## Non-goals for v0.1

Steerion Boundary v0.1 does not install external skills, grant autonomous merge/deploy/release, copy provider credentials, replace BAR Human Gate, or allow a model to edit its own authority policy.

It is intentionally a small deterministic composition layer that can be tested before deeper integrations are considered.
