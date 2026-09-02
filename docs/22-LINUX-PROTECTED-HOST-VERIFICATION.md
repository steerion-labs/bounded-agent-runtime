# Linux Protected-Host Verification Guide

This guide mirrors BAR's fail-closed host-isolation philosophy on Linux. It documents checks only: it does not create users, change privileges, install sandboxing, or claim a kernel boundary that has not been independently verified.

## Target model

Use distinct least-privilege identities for controller, Builder and Reviewer. Workers must not receive controller, Human Gate, release, merge, deploy or provider credentials. The controller remains the sole owner of protected state and authorization decisions.

Recommended protected zones:

- runtime state and journals: controller writable; workers denied
- Human Gate keys and secrets: controller/operator only; workers denied
- evidence store: controller writable; Reviewer read-only only when explicitly required
- candidate workspace: Builder limited to task-allowed paths; Reviewer observation-only
- repository credentials and protected Git metadata: workers denied

## Verification prerequisites

Run verification from an operator shell that can inspect ownership and ACLs. Do not grant extra privileges merely to make a check pass. If the host cannot prove a boundary, record `UNVERIFIED` and keep protected actions disabled.

Record the candidate commit/tree, host identity, BAR version and verification timestamp before testing. Never include secret values in evidence.
## Read-only verification commands

Examples below are inspection commands; adapt paths and account names to the host.

```bash
id controller
id builder
id reviewer
namei -om /var/lib/bar/runtime-state
namei -om /var/lib/bar/secrets
getfacl -p /var/lib/bar/runtime-state /var/lib/bar/secrets
sudo -u builder test ! -r /var/lib/bar/secrets && echo BUILDER_SECRET_DENY_PASS
sudo -u reviewer test ! -w /var/lib/bar/runtime-state && echo REVIEWER_STATE_WRITE_DENY_PASS
sudo -u builder env | grep -E 'GITHUB_TOKEN|GH_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY' && echo CREDENTIAL_LEAK_FAIL || echo BUILDER_CREDENTIAL_SEPARATION_PASS
```

Expected result: worker identities cannot read protected secrets or write protected runtime state, and their environment contains no protected credential variables.

Check candidate/workspace boundaries separately. A Builder may only write the controller-provided candidate workspace and task-allowed paths. A Reviewer must not mutate the candidate. Verify before and after hashes or Git tree identity rather than trusting adapter output.

## Network and process boundary

BAR does not claim Linux network isolation by documentation alone. If the deployment uses namespaces, containers, seccomp, AppArmor, SELinux or systemd hardening, verify the actual effective configuration and expected denial behavior on that host. Missing or ambiguous proof remains `UNVERIFIED`.

Do not silently fall back to a more permissive execution mode if a configured isolation mechanism fails.
## Evidence and failure semantics

Capture only sanitized evidence: command, exit status, identity/ownership metadata, candidate SHA/tree and PASS/FAIL/UNVERIFIED outcome. Redact tokens, key material, home-directory secrets and provider session data.

Fail closed when any of these occurs:

- Builder can read protected secrets or controller state
- Reviewer can mutate candidate or protected state
- worker environment contains protected credentials
- candidate tree changes outside the allowed task delta
- isolation tooling is missing, bypassed or cannot be inspected
- verification cannot bind evidence to the exact candidate

A failed or unverifiable host check does not prove exploitation; it means BAR must not promote that host to protected-action readiness.

## Adapter conformance relationship

This guide does not alter `docs/19-ADAPTER-CONFORMANCE.md`. Adapters remain untrusted execution machinery. Host isolation is an additional boundary and never substitutes for controller-derived Git identity, evidence verification, budgets, Human Gate or protected-action authorization.

## Acceptance record

For a protected-host readiness claim, record explicit outcomes for identity separation, protected-zone ACLs, credential separation, candidate integrity, Reviewer read-only behavior and any configured network/process isolation. Any `UNVERIFIED` item keeps the corresponding protected capability disabled.