# Bounded Agent Runtime Security Matrix

| ID | Severity | Control | Required evidence | Status |
|---|---|---|---|---|
| BAR-SEC-001 | P0 | Authority boundaries are explicit and fail-closed | negative authority tests | OPEN |
| BAR-SEC-002 | P0 | Lease/lock/fencing prevents stale or concurrent effects | concurrency/replay tests | OPEN |
| BAR-SEC-003 | P0 | State-machine transitions cannot be skipped or forged | transition/adversarial tests | OPEN |
| BAR-SEC-004 | P0 | Credentials are isolated from untrusted workers/adapters | env/process/effective-access tests | OPEN |
| BAR-SEC-005 | P0 | Approval is explicit, authenticated, payload-bound and non-inferable | mutation/replay tests | OPEN |
| BAR-SEC-006 | P0 | Recovery/checkpointing and CAS are idempotent and reject stale state | crash/restart/corruption tests | OPEN |
| BAR-SEC-007 | P0 | IPC and path/effect boundaries block traversal, symlink/reparse and unauthorized principals | Windows/Linux host proof | OPEN |
| BAR-SEC-008 | P1 | Dashboard/evidence rendering treats all evidence as untrusted | XSS/HTML injection regressions | OPEN |
| BAR-SEC-009 | P1 | Adapter/version probes cannot inherit authority or hang indefinitely | timeout/minimal-env tests | OPEN |
| BAR-SEC-010 | P1 | Linux/Windows host-isolation claims are evidence-based only | read-only host verification | OPEN |
| BAR-SEC-011 | P1 | Dependency/secret/supply-chain baseline | deterministic local scans | OPEN |

## Active backlog
1. Reconcile current local #6/#7/#8 slices onto a GitHub-visible safe head before treating their evidence as merge-ready.
2. Preserve the post-merge governance finding: technical PASS alone does not prove Human Gate acceptance.
3. Extend adversarial coverage for stale leases, forged transitions, credential inheritance, path/IPC escape, recovery replay and payload substitution.
4. Keep dashboard strictly observation-only and escape all untrusted evidence.
5. Prepare a clear GO/NO-GO package before any release or merge gate.