# Remote Execution Provider Contract

BAR may execute bounded work on remote or ephemeral compute without moving policy or protected authority into an LLM or into the compute provider.

## Invariants

- The provider is compute, never an authority source.
- The task contract is fixed before dispatch and bound to an exact source revision.
- Remote authority is explicit and cannot include protected actions.
- Worker identity, capability fingerprint, lease generation and fencing token hash are bound into every dispatch.
- Provider credentials, repository credentials and private project data are not part of BAR source code.
- Remote workers cannot approve protected actions.
- Candidate SHA/tree, evidence, provider run and exact source HEAD are bound into the returned result.
- A lost or restarted worker must not regain stale authority; lease and fencing checks remain mandatory.
- Replayed results, stale leases, evidence drift, candidate drift and authority widening fail closed.
- Remote execution never implies merge, deploy, release, publish or another protected side effect.

## Machine-readable protocol

runtime/remote/contracts.mjs defines two versioned envelopes.

- bar.remote-task.v1 binds task hash, exact source HEAD, allowed remote actions, protected actions, worker identity/capability hash, lease generation/fence, isolation, network policy and optional expected candidate.
- bar.remote-result.v1 binds the dispatch hash, provider/run identity, authority hash, worker, lease/fence, candidate SHA/tree and evidence hash.

The controller or consuming private system must compare the returned result against the current lease/fence and the actual candidate/evidence before accepting it. A remote provider never receives authority merely because it returns PASS.

## Provider interface

Every provider implements four bounded operations.

1. prepare(dispatch) validates configuration and the immutable dispatch.
2. execute(prepared) runs the declared Builder/Verifier/Reviewer stage inside the provider boundary.
3. collect(run, result) returns a machine-readable result bound to dispatch, provider run and candidate.
4. cancel(run) revokes the current run without granting authority to a replacement.

runtime/remote/reference-provider.mjs implements this interface for the public GitHub-hosted reference proof. Other transports may implement the same interface without changing controller or Human Gate authority.

## GitHub-hosted reference proof

The reference workflow checks out the exact PR HEAD, with contents: read, persist-credentials: false and no repository secrets. It runs the deterministic durability proof and a protocol round-trip, then proves rejection of replay, stale fencing, evidence drift and remote authority widening.

The resulting artifact is bar.remote-execution-proof.v1 and records the exact source HEAD, candidate/tree identity, dispatch/result hashes and negative-control outcomes.

## Privacy boundary

BAR stays public, generic and model/project agnostic. Private repository names, task payloads, business data and private credentials belong to the consuming private system and may only be supplied at runtime through an approved provider transport. They must never be committed into BAR.

## Explicit non-proof

This public reference provider is not a private-repository mutation adapter. It does not receive private task content, push candidates, create pull requests, merge, deploy or release. A consuming system that needs private remote engineering must implement its own private provider transport against this protocol and prove the same lease/fence, candidate, evidence and Human Gate invariants.

Remote compute is capability, never authority.
