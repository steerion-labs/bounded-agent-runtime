# Hermes Agent bounded worker pilot

Status: CONTRACT PILOT ONLY
Reviewed upstream: Hermes Agent v0.21.3 / release tag `v2026.9.14`
Tracking: issue #60

## Decision

Hermes is evaluated as an additional Builder capability under BAR. It is not a BAR replacement and it is not a release, merge, approval or evidence authority.

The initial pilot is deliberately not registered for BAR runtime execution. The repo first proves the adapter policy and negative boundaries without installing Hermes, adding provider credentials or spending model/API budget.

## Why the boundary is stricter than the upstream defaults

Hermes is a broad autonomous agent runtime. Its default CLI toolset includes file access, terminal execution, web/browser access, memory, skills, delegation, code execution, scheduling and other integrations. That breadth is useful for an assistant but larger than the authority BAR grants a disposable coding worker.

The BAR pilot therefore uses an allowlist, not the Hermes default toolset.

## Tool evaluation

| Hermes capability | Initial BAR decision | Reason |
| --- | --- | --- |
| `file` | GO for Builder | Needed for bounded workspace edits. `HERMES_WRITE_SAFE_ROOT` must bind writes to the disposable workspace. |
| `terminal` | GO for Builder, Docker only | Required for local engineering commands. Tool execution must use Docker, no forwarded credentials and `TERMINAL_DOCKER_NETWORK=false`. |
| `web` / `search` | NO-GO initial | Adds external network and untrusted content without being necessary for the first implementation proof. |
| `browser` | NO-GO initial | Adds browser state, external navigation and a much larger side-effect surface. |
| `computer_use` | NO-GO | Desktop control is outside a bounded coding worker's authority. |
| `code_execution` | DEFER | Powerful composition layer that can call other Hermes tools. Re-evaluate only after the minimal worker proves value. |
| `memory` | NO-GO as evidence | Persistent memory is advisory context only. It may never satisfy BAR evidence or a Human Gate. |
| `skills` | NO-GO initial | Skill install/change expands capability. Any future skill must pass BAR/Boundary skill intake first. |
| `delegation` | NO-GO initial | Spawns additional agents and complicates model-call, identity and budget accounting. |
| `cronjob` | NO-GO | Background/scheduled autonomy is outside the worker task lease. |
| MCP toolsets | NO-GO initial | New external systems, credentials and capabilities require separate approval and policy binding. |
| messaging / Discord / Home Assistant / Spotify | NO-GO | Productively changes external systems or communications and is unrelated to a coding worker. |
| vision / image / video | DEFER | No current BAR worker need. Treat as separate media capability later. |
| session search | NO-GO initial | Cross-session context is not deterministic task evidence. |
| worktree | POSITIVE, but BAR remains owner | Hermes worktrees are useful upstream, but BAR already owns disposable workspace/candidate binding and must remain the source of truth. |
| checkpoints / rollback | POSITIVE supplementary | Good recovery UX, but cannot replace git candidate identity, controller evidence or BAR recovery. |
| smart/manual approvals | SUPPLEMENTARY ONLY | Hermes approvals may reduce unsafe tool execution, but BAR authorization and Human Gate remain authoritative. |
| API server / gateway | NO-GO initial | Long-running server surface is unnecessary for a one-shot worker and increases attack surface. |

## Mandatory pilot profile

The pure policy module `runtime/adapters/hermes-policy.mjs` enforces the first-stage contract:

1. exact Hermes version `0.21.3`, release tag `v2026.9.14`
2. Builder role only
3. one-shot finite session
4. `--safe-mode`
5. only `file,terminal` toolsets
6. bounded max turns
7. isolated `HOME`, `USERPROFILE` and `HERMES_HOME`
8. `HERMES_WRITE_SAFE_ROOT` bound to the BAR disposable workspace
9. Docker terminal backend
10. terminal/tool network denied
11. no Docker credential forwarding
12. non-persistent terminal sandbox
13. no inherited provider, GitHub, cloud or operator credentials
14. zero evidence, merge, deploy, release or approval authority
15. explicit Human Gate remains required

## Reviewer decision

Hermes is not admitted as an independent Reviewer in the first pilot.

Reason: the upstream `file` toolset contains both read and write tools. BAR requires reviewer separation that is enforced by runtime capability, not merely by instructions. Until a deterministic read-only Hermes profile is demonstrated, existing BAR reviewer adapters remain the independent review lane.

## Provider/authentication gate

The policy requires an explicit provider and model, but the pilot environment deliberately does not forward provider credentials. Therefore the current PR proves the adapter contract only and cannot make a hosted model call.

A later live execution proof requires a separate Human Gate covering:

- provider choice
- credential delivery mechanism
- expected cost / budget
- network boundary for the model transport
- exact version provenance
- no credential exposure to terminal/file tools

No productive or operator credential should be reused merely to make the proof convenient.

## Promotion criteria

Hermes may be registered as an executable BAR adapter only after all are true:

- contract tests pass on exact PR head
- independent security review has no P0/P1 blocker
- exact Hermes tag provenance is confirmed
- live disposable Builder proof succeeds with separately approved provider credentials or an approved local endpoint
- terminal/file tools cannot read provider credentials
- workspace escape and network-deny negative tests pass
- candidate/head drift invalidates evidence
- timeout and cleanup are deterministic
- measurable capability/reliability value exists versus Codex/Claude/OpenCode

If Hermes only duplicates existing workers while adding attack surface and operational overhead, the final decision is NO-GO.
