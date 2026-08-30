# Security Policy

## Supported versions

Security fixes are applied to the current tagged release and `main`. Older releases may not receive backports unless explicitly stated in release notes.

## Reporting a vulnerability

Do not open a public issue for an authority bypass, credential exposure, sandbox/container escape, reviewer bypass, evidence forgery, Human Gate bypass, MCP authority escalation, network-policy bypass or protected mutation.

Use GitHub Private Vulnerability Reporting when available. Otherwise open a minimal public issue asking for a private reporting channel without exploit details.

Never submit real secrets, tokens, private keys, customer data, proprietary source or production credentials in a report.

## Security scope

BAR separates model reasoning from controller authority. Task policy, candidate identity, controller-observed verification, Evidence and Human Gate authorization are verified independently of agent claims.

Model output, repository content, Reviewer prose, MCP/tool output and dashboard content remain untrusted context.

The optional Docker adapter is the currently implemented isolated Builder/Reviewer execution path for protected runtime use. Local Codex/Claude/OpenCode/Generic adapters are same-host child processes and BAR refuses to treat them as protected-mode worker isolation.

The HTTPS broker is a narrow approved path, not direct-worker egress enforcement. Protected deployments must technically restrict direct worker network access. The Docker adapter uses `--network none`; local CLI adapters inherit the host/network boundary.

Windows scripts create and test role accounts/ACL zones, including real credential probes, but the current controller does not automatically launch local CLI workers under those Windows identities. Do not infer token isolation from account existence alone.

Controller-observed verification commands run as local child processes only outside protected mode. Protected mode fails closed rather than executing project-controlled verification commands under controller credentials.

The journal HMAC protects integrity only while its key/anchor remain controller-only. It does not protect against full controller compromise.

Container image identity is task-bound by immutable repository digest. Docker daemon compromise and malicious image behavior inside the container remain outside BAR's controller guarantee.

## Operational requirements

Before connecting a real mutation adapter, verify the exact runtime release, host identity/access boundary, worker egress boundary, candidate commit/tree, Evidence, Human Gate policy and the adapter's own authorization checks.

Any new adapter, tool fallback, policy expansion, network route, secret path or external side effect changes the threat model and requires negative tests plus re-verification.

## Response expectations

BAR is community open source and provides no contractual SLA. Maintainers should acknowledge valid private reports as soon as practical and publish remediation notes after affected code is fixed.
