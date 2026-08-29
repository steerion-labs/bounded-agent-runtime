# 13 Production Hardening

The included runtime is a reference implementation. Before real remote mutation:

1. Run Controller, Builder and Reviewer as separate OS identities/processes.
2. Prove worker denial to runtime-core, runtime-state, secrets and journal.
3. Keep source-control/deployment credentials controller-only.
4. Replace demo adapters with bounded tool adapters and explicit allowlists.
5. Bind test/review evidence to the exact Git commit and tree.
6. Use an authenticated external signer/identity service for Human Gate.
7. Add network egress policy for worker processes.
8. Add crash/replay tests for every remote mutation adapter.
9. Run hostile prompt, filesystem, credential and stale-controller tests.
10. Never treat this repository alone as a security certification.
