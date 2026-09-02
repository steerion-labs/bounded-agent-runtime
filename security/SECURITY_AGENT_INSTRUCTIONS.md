# Security Agent Instructions

Read `SECURITY_STANDARD.md` and `SECURITY_MATRIX.md` before selecting work. GitHub is Source of Truth.

Order: live preflight -> stale evidence -> P0 -> P1 -> P2 -> P3 -> INFO. Every finding must be reproduced, classified, fixed with the smallest safe scope, covered by negative regression where feasible, checked deterministically, and recorded against the exact Git head.

Never infer Human Accept. Never weaken authority boundaries, lease/lock/fencing, state-machine enforcement, credential isolation, approval gates, recovery/checkpointing, CAS/idempotency, IPC security, path/effect boundaries or protected-main requirements to make tests pass. No merge/release/tag/deploy/force-push/auto-merge without Human Gate. Do not intentionally trigger GitHub Actions/CI/CD.

New attack classes must be checked across all five projects where applicable.