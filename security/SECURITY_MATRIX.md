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
| BAR-SEC-013 | P1 | Adversarial Unicode/obfuscation in untrusted intent or policy identifiers cannot widen authority | clean-room adversarial intent/identifier invariance tests | EVIDENCE_REQUIRED |

## Evidence inventory starting point — NOT a control PASS

The following are **candidate evidence locations only** based on repository inspection at `main` commit `33bad834f2ce60cfff2474b60c5fd5d087ba1f00` (2026-10-09 inventory). They do **not** change the status above, do not prove live-agent resistance, and cannot stand in for a real-host effective-access test. Each control must be reconciled at the latest exact PR HEAD under [#85](https://github.com/steerion-labs/bounded-agent-runtime/issues/85).

| Control | Existing evidence leads to reconcile | Important gap / qualification |
|---|---|---|
| BAR-SEC-001 | `test/runtime.test.mjs`, `test/integration.test.mjs` | Confirm denied actions by observed effects, not agent prose |
| BAR-SEC-002 | `test/runtime.test.mjs`, `test/integration.test.mjs`, `scripts/durability-proof.mjs` | Race and stale-controller effect attempts |
| BAR-SEC-003 | `test/runtime.test.mjs`, `test/integration.test.mjs` | Forged persisted transitions and journal corruption |
| BAR-SEC-004 | `test/container.e2e.mjs`, `test/runtime.test.mjs`, `scripts/verify/Test-WorkerAccess.ps1` | Real-identity host access, secrets and env isolation outstanding |
| BAR-SEC-005 | `test/integration.test.mjs`, `test/runtime.test.mjs` | Live-agent attempts and side-effect adapter policy |
| BAR-SEC-006 | `test/integration.test.mjs`, `scripts/durability-proof.mjs` | Crash/recovery of concrete side-effect integrations |
| BAR-SEC-007 | `test/runtime.test.mjs`, `scripts/verify/Test-WorkerAccess.ps1` | Linux/Windows effective path/IPC and symlink/reparse escape |
| BAR-SEC-008 | `test/dashboard.test.mjs` | Review XSS/escaping negatives and rendering surfaces |
| BAR-SEC-009 | `test/doctor.test.mjs`, `runtime/doctor.mjs` | Minimal-env, timeout and tool-version coverage |
| BAR-SEC-010 | `scripts/verify/Test-HostBaseline.ps1`, `scripts/verify/Test-WorkerAccess.ps1`, `test/container.e2e.mjs` | CI containers do not certify deployment-host isolation |
| BAR-SEC-011 | `.github/workflows/codeql.yml`, `.github/dependabot.yml` | Separate deterministic dependency/secret baseline not yet confirmed |
| BAR-SEC-012 | `.github/workflows/durability-proof.yml`, `scripts/durability-proof.mjs`, `test/remote-execution.test.mjs` | Off-host test != productive host security |
| BAR-SEC-013 | `test/fixtures/adversarial-boundary-cases.json`, `test/runtime.test.mjs` | Verify injection invariance with live bounded agents |

## Priority and control gate

**P0 first:** [#85 Security matrix reconciliation](https://github.com/steerion-labs/bounded-agent-runtime/issues/85) → [#86 Adversarial benchmark](https://github.com/steerion-labs/bounded-agent-runtime/issues/86) and [#87 Host/credential isolation](https://github.com/steerion-labs/bounded-agent-runtime/issues/87). **P1:** [#88 Evidence pack](https://github.com/steerion-labs/bounded-agent-runtime/issues/88). **P2:** [#89 CI and release simplification](https://github.com/steerion-labs/bounded-agent-runtime/issues/89).

See [SECURITY_BACKLOG.md](SECURITY_BACKLOG.md) for full acceptance criteria, execution and stop rules. Historic PR #19 and issues #7/#8 are not current active assignments unless independently re-opened.

A `PASS` for a control requires exact-head observed evidence that covers that control's declared threat and boundary, not merely a green unit-test job. Missing proof remains `EVIDENCE_REQUIRED`; independent review and an explicit Human Gate are required before protected promotion.
