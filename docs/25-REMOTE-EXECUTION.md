# Remote Execution Provider Contract

BAR may execute bounded work on remote or ephemeral compute without moving policy or protected authority into an LLM.

## Invariants

- The provider is compute, never an authority source.
- The task contract is fixed before dispatch and is bound to an exact source revision.
- Workers receive only the capabilities required for their role.
- Provider credentials, repository credentials and private project data are not part of BAR source code.
- Remote workers cannot approve protected actions.
- Candidate identity, verification evidence, review and Human Gate semantics remain controller-owned.
- A lost or restarted worker must not regain stale authority; lease and fencing checks remain mandatory.
- Remote execution never implies merge, deploy, release, publish or other protected side effects.

## Provider interface

A provider implementation must expose four bounded operations:

1. `prepare(task)` — validate provider configuration and produce an immutable dispatch description.
2. `execute(dispatch)` — run the declared Builder/Verifier/Reviewer stage inside the provider boundary.
3. `collect(run)` — return machine-readable evidence bound to task, source revision, provider run and candidate.
4. `cancel(run)` — revoke the current run without granting authority to a replacement.

Every provider must declare its isolation properties, network policy, credential boundary, maximum lifetime and recovery semantics. BAR must fail closed when those properties cannot be verified.

## First reference provider: GitHub-hosted runner

The first reference integration is intentionally generic and public-safe. It proves that BAR can start from a clean GitHub-hosted machine, run its deterministic boundary/recovery proof, and emit machine-readable evidence. It requires no repository secrets and has read-only repository permissions.

This reference proof is not a remote mutation adapter. It does not clone private target repositories, receive private task content, push candidates, create pull requests, merge, deploy or release.

## Future providers

Additional providers such as generic Linux hosts, self-hosted runners or Kubernetes may implement the same contract. Provider-specific code must not change BAR's controller, evidence or Human Gate authority model.
