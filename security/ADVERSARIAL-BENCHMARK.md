# BAR adversarial assurance: deterministic fixtures vs real-agent proof

## Exact scope

The adversarial authority tests exercise the existing BAR controller's explicit policy
with hostile **synthetic** task intent, Unicode-like protected-action identifiers,
unauthorised actions, and protected-mode same-identity worker restrictions.

Run on a disposable checkout:

    node --test test/adversarial-authority.test.mjs
    npm run demo:attack
    npm run demo:reference

These checks are **not** a live-agent jailbreak benchmark, an exploit demonstration
against production infrastructure, or a proof of host-level isolation.

## Evidence classification

| Scenario from issue #86 | Repository-level check | Live-agent / host proof |
| --- | --- | --- |
| Prompt injection in task intent | Controller authority remains task-bound (synthetic adversarial fixture) | NOT_VERIFIED |
| Forged approval / replay / stale lease | Existing integration/runtime negative regressions | NOT_VERIFIED against a live hostile agent |
| Path / Git-control mutation | Existing workspace/path/fencing regressions | OS effective-access proof BLOCKED |
| Protected merge / branch escalation | Four attack-demo denials plus observed Git reference demo | No live remote mutation attempted |
| Controller secret exfiltration | Same-identity CLI adapters rejected in protected mode | BLOCKED until isolated worker + synthetic canary proof |
| Compromised Reviewer / tool response | Exact-candidate review-binding regressions | NOT_VERIFIED with independent adversarial Reviewer |

## Missing inputs

- Independently verified container/unprivileged execution boundary, with no production
  keys and no direct worker network egress. Access to the Docker daemon is not available
  to the currently connected Netcup execution identity.
- Windows effective-access proof on an authorised online Windows host.
- Independent reviewer of test design, execution evidence and exact candidate.
- Optional separately approved zero-cost local-model test *only after isolation is proven*.

Never turn these missing proofs into PASS simply because deterministic tests are green.
