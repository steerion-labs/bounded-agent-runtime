# Linux Protected Host Verification Guide

This guide mirrors BAR's fail-closed host-isolation philosophy for Linux without claiming that BAR itself creates or proves an operating-system sandbox.

## Goal

Run Builder and Reviewer processes under dedicated least-privilege identities, keep controller state, evidence and credentials outside their writable scope, and verify expected access failures before treating the host as suitable for bounded work.

## Suggested identities and zones

Use separate non-root users, for example `bar-controller`, `bar-builder`, and `bar-reviewer`. The Builder and Reviewer must not be members of privileged groups and must not inherit controller, GitHub, cloud, SSH-agent, Docker-socket, sudo, or secret-store credentials.

A practical layout is:

```text
/var/lib/bar/controller-state   controller only
/var/lib/bar/evidence           controller writable, workers read only when explicitly required
/var/lib/bar/secrets            controller only
/var/lib/bar/workspaces/<task>  task-scoped Builder workspace
/var/lib/bar/review/<task>      Reviewer read-only candidate view
```

Do not rely on directory names as protection. Enforce ownership and mode/ACLs at the host layer.

## Baseline verification

Run these checks as an administrator or provisioning identity, adapting the paths to your installation:

```bash
id bar-controller
id bar-builder
id bar-reviewer
stat -c '%U %G %a %n' /var/lib/bar/controller-state /var/lib/bar/evidence /var/lib/bar/secrets
getfacl -p /var/lib/bar/controller-state /var/lib/bar/evidence /var/lib/bar/secrets
```

Expected result: worker identities have no write access to controller state, protected evidence, or secrets. Reviewer access should be read-only and task-scoped when it is needed at all.

## Negative access probes

Use the real worker identities. Expected failures are part of the proof:

```bash
sudo -u bar-builder sh -c 'test ! -r /var/lib/bar/secrets && test ! -w /var/lib/bar/controller-state'
sudo -u bar-reviewer sh -c 'test ! -r /var/lib/bar/secrets && test ! -w /var/lib/bar/evidence'
sudo -u bar-builder sh -c 'touch /var/lib/bar/controller-state/SHOULD_FAIL'
sudo -u bar-reviewer sh -c 'touch /var/lib/bar/evidence/SHOULD_FAIL'
```

The two `touch` commands must fail. Verify that neither file exists afterwards. A successful protected write is a host-boundary failure and BAR operation must stop until the permissions are corrected.

## Credential separation probes

Check the worker environment rather than assuming a separate username is sufficient:

```bash
sudo -u bar-builder env | grep -Ei 'github|token|secret|api[_-]?key|aws|azure|gcp|ssh_auth_sock' && exit 1 || true
sudo -u bar-reviewer env | grep -Ei 'github|token|secret|api[_-]?key|aws|azure|gcp|ssh_auth_sock' && exit 1 || true
sudo -u bar-builder test ! -S /var/run/docker.sock
sudo -u bar-reviewer test ! -S /var/run/docker.sock
```

Also inspect credential helpers, SSH configuration, mounted home directories, agent sockets, container groups and any organization-specific secret tooling. Absence from environment variables alone is not a complete credential proof.

## Workspace proof

Give the Builder only the task workspace it needs. Give the Reviewer an independently prepared read-only candidate view. Verify effective access with the real identities:

```bash
sudo -u bar-builder test -w /var/lib/bar/workspaces/TASK_ID
sudo -u bar-builder test ! -w /var/lib/bar/review/TASK_ID
sudo -u bar-reviewer test -r /var/lib/bar/review/TASK_ID
sudo -u bar-reviewer test ! -w /var/lib/bar/review/TASK_ID
```

If the Reviewer can mutate its candidate, independent-review evidence is invalid until the boundary is repaired and the review is rerun.

## Process and network boundary

BAR does not claim that an ordinary Linux user account is a complete sandbox. If a task requires stronger isolation, use an independently reviewed host mechanism such as a disposable container or another OS isolation layer. Preserve BAR's controller ownership of authority, evidence, budgets and protected mutations. Do not weaken the adapter contract merely to make an external CLI run.

Where network isolation is required, verify it with the actual worker execution context. Do not claim `NETWORK_DENIED` from configuration text alone.

## BAR checks after host verification

Run:

```bash
bar doctor
bar agents
```

Then execute only a synthetic bounded task first. Confirm that missing executables, invalid reviewer output, timeout, candidate drift, reviewer mutation and verification failure still fail closed as required by `docs/19-ADAPTER-CONFORMANCE.md`.

## Evidence to retain

Record the host/kernel identity, BAR version and source commit, user/group identities, protected-zone ownership and ACL output, negative-probe results, workspace access results, adapter versions, and the exact synthetic task result. Sanitize evidence before sharing and never include credentials or secret values.

## Acceptance

Linux protected-host verification is PASS only when the effective access probes demonstrate least privilege with expected protected-write failures, credentials are not exposed to Builder/Reviewer, Reviewer state is read-only, a synthetic BAR task preserves the adapter contract, and no stronger sandbox or network-isolation claim is made without separate observed evidence.
