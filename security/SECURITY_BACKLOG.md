# Bounded Agent Runtime Security Backlog

> **Active plan as of 2026-10-09.** Issues are ordered by security risk and evidence dependencies, **not** dates or promises of automatic execution. Source baseline: `main` commit `33bad834f2ce60cfff2474b60c5fd5d087ba1f00`. Re-check exact HEAD before using results or performing work.

## P0 — Security first

1. **[#85 — Exact-head security assurance matrix and evidence reconciliation](https://github.com/steerion-labs/bounded-agent-runtime/issues/85)** — **FIRST.** For BAR-SEC-001 through BAR-SEC-013, map each claim to current tests, exact commit/tree, run IDs, observable results and missing evidence. Preserve `EVIDENCE_REQUIRED` until proof is sufficient. Do not equate a successful workflow with a production host guarantee.
2. **[#86 — Isolated real-agent adversarial boundary benchmark](https://github.com/steerion-labs/bounded-agent-runtime/issues/86)** — After #85's gap inventory, exercise prompt injection, Human Gate/replay/fence bypass, candidate/evidence tampering, path/Git escape and attempted canary exfiltration against an isolated agent. Start with deterministic negative cases; run a live agent only in an approved bounded sandbox. No productive side effects, real secrets or unapproved API spend.
3. **[#87 — Effective credential, filesystem and host isolation proof](https://github.com/steerion-labs/bounded-agent-runtime/issues/87)** — Validate effective denied access for real worker identities, Linux and Windows separately, plus container boundaries. A Docker flag or static ACL check is not effective-access evidence. Never claim fully compromised controller/Docker daemon resistance.

## P1 — Reproducible evidence for independent review

4. **[#88 — Security evidence pack](https://github.com/steerion-labs/bounded-agent-runtime/issues/88)** — Reuse BAR's existing off-host durability/CI evidence and security matrix; produce a small reproducible machine-readable manifest and human summary with exact SHA/tree, negative test observations, provenance, failure/blocked results and checksums. No dashboard or new service. Independent human review is still necessary.

## P2 — Simpler operations after security gates

5. **[#89 — Reduce proof CI overhead and clarify release gates](https://github.com/steerion-labs/bounded-agent-runtime/issues/89)** — Measure GitHub Actions cost and lost detection latency before changing hourly/daily schedules; keep security-critical PR gates. Do not release the current `main` merely because v0.5.0 CI or documentation exists. PR #80 (Dependabot upload-artifact) remains a separate review.

## Current verified signals are not a certification

At the above exact main commit, BAR CI (Node 20, Node 22, Container E2E), CodeQL and Linux/Windows core durability jobs reported success in GitHub-hosted workflows on 2026-10-08/09. This is **CI observation** only; an independent live-agent adversarial assessment and effective host-access evidence are not established by those results. Container-only scheduled proofs can be intentionally skipped outside their daily cadence.

The independent evaluation offer from an unsolicited vendor is **not** a vulnerability report or an audit result. No purchase is required for this work. If external evaluation is later desired, the operator must approve its cost, precise scope and what data can be shared.

## Execution and stop rules

- **Source of truth:** live `main` HEAD, then exact PR-head tests, plus controller-observed evidence. Do not reuse stale PASS from a previous candidate.
- **Fail closed:** no scope widening, silent agent fallback, secret exposure, bypass of Human Gate, or productive remote mutation for testing.
- **Security incident:** a real authority bypass or credential exposure means STOP; use the private vulnerability process in `SECURITY.md`, not public exploit instructions.
- **Separation:** agent claims or independent Reviewer prose never replace deterministic checks or Human Gate.
- **Human Gate:** security-sensitive modifications require independent review and explicit accept before merge/release. This plan itself authorises no merge, deploy, external write or API expense.
- **Status vocabulary:** PASS = required exact-head evidence complete; PARTIAL = some proof only; REVIEW_REQUIRED = independent assessment / Human Gate outstanding; BLOCKED = missing access/conditions; EVIDENCE_REQUIRED = no adequate control proof yet.

## Existing history

Earlier security work is documented in closed issues, previous commits and `security/SECURITY_MATRIX.md`. Historic references to PR #19, issue #7 and issue #8 are not active task assignments; do not use them as current work queue without a new live check. Preserve the historical record in GitHub.
