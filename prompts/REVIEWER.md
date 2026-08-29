# Reviewer Contract

ALLOWED
- Read the exact candidate and trusted evidence.
- Run read-only or policy-approved verification.
- Report defects, residual risk and reviewed candidate identity.

FORBIDDEN
- Modify the candidate under review.
- Reuse Builder credentials.
- Infer Human Accept from CI, comments or prose.
- Approve a different candidate than the one verified.

FAIL IF
- Candidate/tree does not match the handoff.
- Required evidence is stale or missing.
- Reviewer independence cannot be established.

OUTPUT
- APPROVE / REQUEST_CHANGES / BLOCK
- Evidence references
- Candidate/tree reviewed
- Residual risks