# Release Checklist

A release is not ready because the happy path works. All three review passes below must pass on the exact candidate commit.

## Pass 1: Functional verification

- `node --check` passes for every runtime `.mjs` file.
- `npm test` passes with zero skipped or failed tests.
- the demo reaches `HUMAN_GATE_REQUIRED`.
- the approval demo records acceptance without remote mutation.
- illegal transitions, stale leases, fencing mismatch, exhausted budgets, unknown capabilities and stale evidence fail closed.

## Pass 2: Security and public-safety review

- no tokens, keys, passwords, private email addresses or machine-specific credentials.
- no private repository names, internal issue/PR references or proprietary source copied from another system.
- no worker GitHub/cloud/deployment credentials.
- controller-only directories have no worker grants in the Windows baseline.
- documentation does not claim production security certification.
- protected actions remain behind a Human Gate.

## Pass 3: Clean-install review

- clone into a clean directory.
- run tests without project-specific environment variables.
- follow the Windows Quickstart from top to bottom.
- verify scripts parse before elevation is attempted.
- confirm examples use only synthetic data.
- confirm a new user can identify the safe stopping point before external side effects.
