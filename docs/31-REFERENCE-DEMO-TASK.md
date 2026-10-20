# BAR real-repository reference demo — delivery task

Status: PLANNED / NOT IMPLEMENTED. This document is a delivery contract, not test evidence.

## Goal
Demonstrate BAR against a disposable synthetic repository: one allowed coding task, controller-observed verification and separate review, plus deterministic denial of an out-of-scope or protected operation. Reuse existing BAR code, examples, scripts and adapter interfaces. No new repo, framework or agent.

## Acceptance criteria
- [ ] One-command clean-checkout setup and cleanup; Node.js 20+ and Git; no secrets, accounts or production data required for deterministic checks.
- [ ] A reproducible allowed source change is tied to controller-owned candidate commit/tree and recorded verification.
- [ ] Real agent invocation is clearly labelled and optional when it requires an external model or cost; synthetic simulation must not be advertised as a live agent test.
- [ ] A default-branch write, path escape, request tamper or protected merge attempt is deterministically blocked before a side effect.
- [ ] Negative regression test proves the guard actually detects a violation; never disable production security.
- [ ] Independent reviewer evidence is attached to exact candidate, without pretending process separation proves organizational independence.
- [ ] Clear exact-HEAD evidence: host OS, runtime/adapter versions, commands, pass/fail/skip counts, known limits.
- [ ] Windows and Linux native results recorded where accessible; otherwise mark NOT_VERIFIED.
- [ ] Existing tests and demo:attack continue to pass in local bounded runs; do not consume GitHub Actions quota.
- [ ] README links the verified example when implemented; preserve honest sandbox/network/security limitations.
- [ ] Exact-head independent security review and explicit Human Gate before merge; no release/deploy authorization implied.

## Adoption / community follow-up
After successful proof, publish a short reproducible walkthrough, invite external feedback through existing GitHub Issues/Discussions, and track GitHub unique visitors, clones, external issues, stars and contributors. Clone events are not necessarily human users.

## Scope protection
Existing documentation-only PR #95 remains separate. No real privileged actions, automatic merge, release, external side effects, untracked spend or secrets. Keep this PR Draft until implemented and verified.
