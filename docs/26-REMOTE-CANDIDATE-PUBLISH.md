# Remote Candidate Publication V2

Status: BOUNDED CONTRACT / SYNTHETIC PUBLIC PROOF / NO PRIVATE REMOTE MUTATION

Remote Execution V1 proves that bounded work can run on ephemeral remote compute without moving authority into the provider. Candidate Publication V2 defines the next boundary: how a verified candidate may later be handed to an isolated review branch and pull request without granting merge or production authority.

## Authority rule

Candidate publication is not promotion.

The V2 contract may authorize only:
- `candidate_branch_create`
- `candidate_pr_create`

It never authorizes:
- direct default-branch writes
- force push
- merge or auto-merge
- deploy or release
- production publishing
- repository settings changes
- credential escalation
- live trading or another protected business effect

The allowed branch namespace is `bar-candidate/*`. A candidate publisher must not overwrite an unrelated existing branch.

## Bound request

`bar.candidate-publication-request.v1` binds:
- operation id
- repository identity and remote fingerprint
- base branch and exact base HEAD
- candidate SHA and tree
- evidence hash
- exact candidate branch
- positive action allowlist
- provider and worker identity
- lease generation and fencing-token hash
- expiry
- explicit false values for force/default-branch/merge/deploy/release/productive authority

The full request is SHA-256 bound and deeply immutable in-process. A deserialized or mutated request fails validation unless it exactly matches the original bound content.

## Bound receipt

`bar.candidate-publication-receipt.v1` binds:
- request hash and operation id
- provider/run identity
- repository identity
- observed base HEAD
- candidate branch / remote ref
- remote candidate SHA/tree
- evidence hash
- pull-request number where requested
- worker identity
- lease/fence
- explicit proof that protected effects were not attempted

Before accepting a receipt, the consuming controller must re-check the current remote default-branch HEAD. Any base drift invalidates publication authority.

## Idempotency and collision safety

A mandatory publication ledger binds:
- exact request -> exact receipt
- repository + candidate branch -> exact base/candidate/tree/evidence binding

Exact replay of the same request/receipt is idempotent. Reusing a candidate branch for a different candidate fails closed.

## Credentials and privacy

Credentials are not part of the request or receipt schema. Public BAR never stores private repository credentials, private task payloads or portfolio state.

A private consuming system may later supply short-lived runtime credentials to its own provider transport. That transport must prove least privilege and must not log, persist or return credential material.

## Public reference proof

The public reference provider is deliberately synthetic. Its workflow has `contents: read`, persists no checkout credentials, requires no repository secrets and performs no branch creation or PR creation.

It proves the request/receipt contract, base-drift rejection, protected-action rejection, collision rejection and idempotent replay only.

## Explicit non-proof

This V2 slice does **not** prove:
- private-repository access
- a real remote branch push
- real pull-request creation
- private credential transport
- GitHub App/PAT permission design
- merge, deployment or release

Those belong to a private consuming transport such as My Company and must be proven separately without adding private project state to public BAR.

Candidate publish != merge. Human Merge Gate remains authoritative.
