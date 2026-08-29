# 08 Verify Before Autonomy

Do not grant broad autonomous mutation capability until the setup survives negative tests.

Minimum verification pack:

- Controller, Builder and Reviewer identities are distinct.
- Builder and Reviewer are non-admin.
- Workers cannot read controller secrets.
- Builder can write only its assigned workspace.
- Reviewer cannot modify the candidate under review.
- Stale lease/fencing tokens are rejected.
- Candidate/tree mismatch invalidates evidence.
- Post-test mutation invalidates prior evidence.
- Forged or stale evidence is rejected.
- Invalid state transitions fail closed.
- Prompt injection in handoff/evidence is treated as data.
- Controller restart does not duplicate protected mutations.
- Budget/retry exhaustion stops execution.
- Human Gate cannot be inferred from silence or text.
- Worker has no source-control write credentials.

Only after these pass should the automatic scope be expanded.