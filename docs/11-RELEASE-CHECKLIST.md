# Release Checklist

A release is not ready because the happy path works. All passes below must be run against the exact candidate commit.

## Pass 1: Functional verification

- `node --check` passes for every runtime `.mjs` file.
- every PowerShell file parses without errors.
- `npm test` passes with zero skipped or failed tests.
- the demo reaches `HUMAN_GATE_REQUIRED` without remote mutation.
- authenticated approval succeeds only for the exact candidate and configured approver.

## Pass 2: Adversarial controller verification

The automated tests must fail closed for:

- forged `ACCEPTED` state
- state rollback against a newer authenticated journal
- approval replay after state rollback
- approval public-key substitution
- journal truncation and middle-entry tampering
- candidate drift after approval
- evidence modification
- stale lease/fencing takeover
- hanging worker process beyond wall-clock budget
- hostile global Git hooks/configuration
- path traversal and hardlink escape

## Pass 3: Windows boundary verification

- `Test-HostBaseline.ps1` passes.
- `Test-StaticAcl.ps1` passes using SID-based checks.
- `Test-WorkerAccess.ps1` passes using real Builder and Reviewer credentials on the target host.
- worker identities are non-admin and cannot read controller state, secrets or journal.

## Pass 4: Public-safety and clean-install review

- no secrets, tokens, private keys, personal data or private project references exist in the worktree or reachable history.
- clone into a clean directory and run the documented commands without project-specific knowledge.
- README claims match implemented enforcement and clearly distinguish demo mode from protected mode.
- external mutation remains absent until a separately reviewed idempotent adapter is added.
