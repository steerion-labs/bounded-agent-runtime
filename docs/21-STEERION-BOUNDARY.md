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
5. required verification evidence is BAR-HMAC verified, controller-owned and bound to task, capability, action, role and candidate identity,
6. protected effects reach the Human Gate.

Unknown capability, unknown action, unsafe routing or binding drift fails closed.

## v0.1 modules

- `capability-registry.mjs`: typed capability contracts
- `authority-engine.mjs`: deterministic `ALLOW_LOCAL`, `HUMAN_GATE_REQUIRED`, `DENY`
- `agent-router.mjs`: pre-execution adapter selection
- `provider-router.mjs`: data-class-aware provider selection
- `binding.mjs`: exact task/capability/action/role/adapter/provider/data-class/candidate binding
- `evidence-contract.mjs`: BAR-HMAC-verified, controller-owned verification evidence
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

## Provider and capability promotion

External capabilities and providers are never trusted because they are discoverable or installed. New entries begin disabled and without authority.

Promotion is explicit:

```text
DISCOVERY_ONLY
  -> official documentation verified
  -> privacy and data-use policy classified
  -> authentication and compatibility verified
  -> allowed capabilities and data classes assigned
  -> VERIFIED but disabled
  -> explicit enablement
  -> routable provider
```

Runtime availability never substitutes for registry approval, and registry approval never substitutes for runtime readiness. Both are required. Provider policy is hashed into the execution binding; missing registry state or policy-hash drift fails closed before routing.

Provider selection remains deterministic and pre-execution. Rate limits, cost or availability changes do not authorize silent fallback to another provider.
## Non-goals for v0.1

Steerion Boundary v0.1 does not install external skills, grant autonomous merge/deploy/release, copy provider credentials, replace BAR Human Gate, or allow a model to edit its own authority policy.

It is intentionally a small deterministic composition layer that can be tested before deeper integrations are considered.
