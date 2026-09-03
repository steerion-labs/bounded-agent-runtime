# Security Agent Instructions

Read `SECURITY_STANDARD.md`, `SECURITY_MATRIX.md` and current repository governance before selecting work. GitHub `main` and the exact candidate HEAD are the source of truth.

Order: live preflight -> stale evidence -> P0 -> P1 -> P2 -> P3 -> INFO. Every finding must be reproduced, classified, fixed with the smallest safe scope, covered by a negative regression where feasible, checked deterministically, and recorded against the exact Git HEAD.

Never infer Human Accept. Never weaken authority boundaries, lease/lock/fencing, state-machine enforcement, credential isolation, approval gates, recovery/checkpointing, CAS/idempotency, IPC security, path/effect boundaries or protected-main requirements to make tests pass. No merge/release/tag/deploy/force-push/auto-merge without the required gate. Do not add automatic GitHub Actions triggers merely for convenience.

Newly confirmed attack classes must be checked across all applicable BAR capabilities and adapters. Cross-repository propagation belongs outside this public repository unless explicitly documented as public scope.
