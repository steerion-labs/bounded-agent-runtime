# Bounded Agent Runtime Security Matrix

| ID | Severity | Control | Required evidence | Status |
|---|---|---|---|---|
| BAR-SEC-001 | P0 | Authority boundaries are explicit and fail-closed | negative authority tests | EVIDENCE_REQUIRED |
| BAR-SEC-002 | P0 | Lease/lock/fencing prevents stale or concurrent effects | concurrency/replay tests | EVIDENCE_REQUIRED |
| BAR-SEC-003 | P0 | State-machine transitions cannot be skipped or forged | transition/adversarial tests | EVIDENCE_REQUIRED |
| BAR-SEC-004 | P0 | Credentials are isolated from untrusted workers/adapters | env/process/effective-access tests | EVIDENCE_REQUIRED |
| BAR-SEC-005 | P0 | Approval is explicit, authenticated, payload-bound and non-inferable | mutation/replay tests | EVIDENCE_REQUIRED |
| BAR-SEC-006 | P0 | Recovery/checkpointing and CAS are idempotent and reject stale state | crash/restart/corruption tests | EVIDENCE_REQUIRED |
| BAR-SEC-007 | P0 | IPC and path/effect boundaries block traversal, symlink/reparse and unauthorized principals | Windows/Linux host proof | EVIDENCE_REQUIRED |
| BAR-SEC-008 | P1 | Dashboard/evidence rendering treats all evidence as untrusted | XSS/HTML injection regressions | EVIDENCE_REQUIRED |
| BAR-SEC-009 | P1 | Adapter/version probes cannot inherit authority or hang indefinitely | timeout/minimal-env tests | EVIDENCE_REQUIRED |
| BAR-SEC-010 | P1 | Linux/Windows host-isolation claims are evidence-based only | host verification evidence | EVIDENCE_REQUIRED |
| BAR-SEC-011 | P1 | Dependency/secret/supply-chain baseline | deterministic local scans | EVIDENCE_REQUIRED |
| BAR-SEC-012 | P1 | Cloud engineering PASS is bound to an exact clean candidate and cannot stand in for host-security proof | clean-head SHA/tree proof + negative dirty/drift checks | IN_PROGRESS |

## Active backlog
1. Complete PR #19 cloud-parity evidence against an exact clean candidate; no automatic Actions are required.
2. Land and verify adapter-version diagnostics for issue #7 without granting project authority during probes.
3. Land and verify read-only dashboard evidence timeline for issue #8 with untrusted evidence escaping.
4. Preserve the governance rule that technical PASS never substitutes for Human Gate where required.
5. Extend adversarial coverage for stale leases, forged transitions, credential inheritance, path/IPC escape, recovery replay and payload substitution.
6. Add a deterministic dependency/secret/supply-chain baseline without uploading repository contents to third parties by default.

Status values describe repository evidence state, not absolute security. A status may only move to PASS when exact-head evidence is recorded and remains valid for the current candidate.
