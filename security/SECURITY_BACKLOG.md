# Bounded Agent Runtime Security Backlog

1. P0: authority boundaries, state-machine enforcement, lease/lock/fencing and stale-effect rejection.
2. P0: credential isolation, payload-bound explicit approval, recovery/checkpoint/CAS idempotency.
3. P0: Windows/Linux host proof for IPC, path/effect boundaries, symlink/reparse escape and unauthorized principals.
4. P1: complete exact-candidate cloud-parity evidence for PR #19 without weakening host-specific security claims.
5. P1: add adapter/version diagnostics for issue #7 with timeout, minimal environment and no project authority.
6. P1: improve the read-only evidence timeline for issue #8 while treating all rendered evidence as untrusted.
7. P1: add deterministic dependency/secret/supply-chain baseline checks.
8. Preserve the governance gate: technical PASS does not substitute for independent security review plus Human Gate where required.

Do not claim host isolation, protection, cloud parity or release readiness without exact evidence tied to the current candidate.
