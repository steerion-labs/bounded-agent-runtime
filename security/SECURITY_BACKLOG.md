# Bounded Agent Runtime Security Backlog

1. P0: authority boundaries, state-machine enforcement, lease/lock/fencing and stale-effect rejection.
2. P0: credential isolation, payload-bound explicit approval, recovery/checkpoint/CAS idempotency.
3. P0: Windows/Linux host proof for IPC, path/effect boundaries, symlink/reparse escape and unauthorized principals.
4. P1: land and reverify dashboard XSS hardening, adapter/version minimal-env timeout handling and Linux proof guidance on a GitHub-visible exact head.
5. P1: add deterministic dependency/secret/supply-chain baseline.
6. Preserve the governance gate: technical PASS does not substitute for independent security review plus Human Gate before merge/release.

Do not claim host isolation, protection or release readiness without exact evidence.