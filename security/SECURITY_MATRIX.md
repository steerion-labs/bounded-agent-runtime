# Bounded Agent Runtime Security Matrix

Security status is evidence-bound. **PASS never means “certified secure”.** It means the named control has repository-level evidence that can be reproduced at the exact candidate with `npm run evidence:security`.

| ID | Severity | Control | Repository evidence | Status |
|---|---|---|---|---|
| BAR-SEC-001 | P0 | Authority boundaries are explicit and fail-closed | `test/runtime.test.mjs`, `test/candidate-publication.test.mjs`, public attack demo | PASS |
| BAR-SEC-002 | P0 | Lease/lock/fencing prevents stale or concurrent effects | `test/runtime.test.mjs`, `test/integration.test.mjs`, `test/remote-execution.test.mjs`, `test/review-resume.test.mjs` | PASS |
| BAR-SEC-003 | P0 | State-machine transitions cannot be skipped or forged | `test/runtime.test.mjs`, `test/integration.test.mjs` | PASS |
| BAR-SEC-004 | P0 | Credentials are isolated from untrusted workers/adapters | minimal-env/credential-schema tests exist; real worker effective-access proof still required by #87 | PARTIAL |
| BAR-SEC-005 | P0 | Approval is explicit, authenticated, payload-bound and non-inferable | nonce replay, key substitution, payload/candidate drift and receipt tests in `test/integration.test.mjs` and `test/runtime.test.mjs` | PASS |
| BAR-SEC-006 | P0 | Recovery/checkpointing and CAS are idempotent and reject stale state | recovery, journal integrity, crash-forward and fencing tests in `test/integration.test.mjs` plus durability proof | PASS |
| BAR-SEC-007 | P0 | IPC and path/effect boundaries block traversal, symlink/reparse and unauthorized principals | traversal/workspace tests exist; Windows/Linux token-level effective-access proof remains #87 | BLOCKED |
| BAR-SEC-008 | P1 | Dashboard/evidence rendering treats all evidence as untrusted | `test/dashboard.test.mjs`: textContent rendering and read-only surface | PASS |
| BAR-SEC-009 | P1 | Adapter/version probes cannot inherit authority or hang indefinitely | `test/doctor.test.mjs`, CLI launcher tests: minimal env, timeout and bounded parsing | PASS |
| BAR-SEC-010 | P1 | Linux/Windows host-isolation claims are evidence-based only | host scripts exist; current host proof must be run per named host/configuration | BLOCKED |
| BAR-SEC-011 | P1 | Dependency/secret/supply-chain baseline | evidence pack scans tracked files for common secret formats and fingerprints `package-lock.json`; history scan remains separate | PARTIAL |
| BAR-SEC-012 | P1 | Engineering PASS is bound to an exact clean candidate and cannot stand in for host-security proof | evidence pack records HEAD, tree, clean tracked state and per-file results; off-host evidence remains a separate claim | PARTIAL |
| BAR-SEC-013 | P1 | Adversarial Unicode/obfuscation in untrusted intent or policy identifiers cannot widen authority | malformed identifier test including zero-width Unicode plus untrusted-intent authority-invariance regression in `test/runtime.test.mjs` | PASS |

## Reproduce the repository evidence

From a clean checkout of the exact candidate:

```bash
npm ci --ignore-scripts
npm run evidence:security
```

The generator writes:

- `bar-proof/security-evidence/manifest.json`
- `bar-proof/security-evidence/summary.md`

The manifest records exact HEAD/tree, clean tracked state, platform/Node version, a tracked-file secret baseline, lockfile fingerprint and **each test file as a separate bounded process**. One timeout or failed file makes the overall result `REVIEW_REQUIRED`; it never becomes a blanket PASS.

Where Docker evidence is required:

```bash
node scripts/security-evidence-pack.mjs --out bar-proof/security-evidence --include-container
```

## Current blockers

### BAR-SEC-004 / 007 / 010

Repository tests cannot prove a real host's identity/ACL boundary. #87 requires effective-access evidence on a named Linux/Windows deployment. Static ACL inspection alone is insufficient.

### BAR-SEC-011

The local tracked-file scan is a candidate hygiene check, not a full Git-history secret scanner and not a third-party supply-chain audit.

### BAR-SEC-012

A local exact-head PASS does not substitute for an off-host runner, real deployment proof, independent review or Human Gate.

## Governance

Status values describe the evidence state of a specific control, not absolute security:

- **PASS** — named repository behavior has reproducible exact-candidate evidence.
- **PARTIAL** — meaningful evidence exists but an explicitly named layer remains unproven.
- **REVIEW_REQUIRED** — evidence exists but failed/timed out or needs independent interpretation.
- **BLOCKED** — required evidence cannot be produced by the repository-only boundary.

Any new adapter, permission, network route, secret path, host configuration or protected side-effect changes the threat model and requires re-verification.
