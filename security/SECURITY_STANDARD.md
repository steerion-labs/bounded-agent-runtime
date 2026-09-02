# Steerion Security Assurance Standard v1

Goal: no known P0/P1 gaps, least authority, safe defaults, deterministic adversarial tests, and exact-head evidence. Absolute security cannot be guaranteed; every claim must be bounded and testable.

Mandatory domains: source/supply-chain, authority and approval, agent/runtime boundaries, path/IPC/credential isolation, lease/fencing/CAS, recovery/idempotency, host isolation, adversarial evaluation, and exact-head evidence.

P0 = authority/safety boundary bypass. P1 = exploitable blocker or missing proof for a critical boundary. P2 = material hardening weakness. P3 = defense-in-depth. INFO = verified observation.

No P0/P1 may be silently waived. Human Accept is never inferred. Head changes stale prior evidence. Fixes require regression tests whenever feasible. Newly confirmed attack classes must be checked across all five projects where applicable.