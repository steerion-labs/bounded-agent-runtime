# Bounded Agent Runtime

**A Steerion Labs open-source reference for building autonomous AI engineering systems with bounded authority, isolated execution, verified evidence and explicit human gates.**

Bounded Agent Runtime helps teams use coding agents without giving a model unrestricted authority over a workstation, repository, credentials or deployment surface.

## Why use it?

Most agent setups focus on what an AI can do. This project focuses on what it is allowed to do, how that authority is enforced and how a human can verify the result before a protected action occurs.

It gives you a reusable starting point for:

- separating Controller, Builder and Reviewer responsibilities
- limiting worker filesystem and credential access
- enforcing capabilities, leases, fencing and execution budgets
- binding tests and reviews to the exact Git commit and tree
- journaling state transitions for recovery and audit
- requiring authenticated human approval for protected actions
- connecting different model or coding-agent providers without making them the authority source

## Good fit

Use this repository when you want agents to perform bounded engineering work automatically while keeping merge, deploy, release, permission, policy and secret changes under explicit control.## Core invariant

```text
Agents think.
Controller authorizes execution.
Workers execute within bounded capabilities.
Evidence is bound to the exact candidate.
Humans authorize protected decisions.
```

## Reference flow

```text
Task -> Controller -> Builder -> Test/Evidence -> Validated Handoff
     -> Independent Reviewer -> Controller -> Human Gate
```

The included Node.js reference runtime implements deterministic state transitions, leases/fencing checks, enforced model/retry/wall-clock budgets, real local Git commit/tree binding, journal reconciliation and a protected Human Gate. It deliberately performs no real remote mutation.

The demo Builder and Reviewer adapters are logically separated but execute in one Node.js process. Do not treat that demo as OS-level reviewer independence. Real use requires separate worker identities/processes and verified effective-access boundaries.

## What is included

- provider-neutral controller reference runtime
- Builder and Reviewer demo adapters
- one canonical task model
- authority, evidence and handoff examples
- Windows role-account and ACL setup scripts
- host-baseline and effective-access checks
- negative tests for stale leases, fencing, budgets, capability denial, stale evidence, journal tampering, approval replay and candidate drift
- threat model, production-hardening guidance and release checklist## Install and verify

Prerequisites: Windows 11 Pro or Enterprise, Git, Node.js 20+ and PowerShell 5.1+ or PowerShell 7.

```powershell
git clone <repository-url>
cd bounded-agent-runtime
npm test
npm run demo:reset
npm run demo:init
npm run demo:run
```

The demo must stop at `HUMAN_GATE_REQUIRED` and must not configure a Git remote or perform any external mutation.

To install the Windows isolation baseline, open an elevated PowerShell and run:

```powershell
.\scripts\windows\Install-BoundedAgentRuntime.ps1
.\scripts\verify\Test-HostBaseline.ps1
.\scripts\verify\Test-EffectiveAccess.ps1
```

Do not attach source-control, cloud or deployment credentials until the verification checks pass on the target host.

## Authenticated Human Gate demo

```powershell
npm run gate:keygen -- .human-gate
$env:BOUNDED_AGENT_APPROVAL_PUBLIC_KEY = (Resolve-Path .human-gate\public.pem).Path
npm run demo:init
npm run demo:run
$signature = node runtime\gate.mjs sign .human-gate\private.pem
node runtime\controller.mjs approve $signature
```The Ed25519 approval signature is bound to the exact task, candidate, tree, state version and nonce. The demo records acceptance but still does not merge, deploy, publish or mutate a remote system.

## Security model

Workers must not receive controller credentials. Free text, model output, repository text, handoffs and memory are untrusted context, never authority. Unknown capabilities fail closed. Protected actions require an authenticated Human Gate bound to the exact task and candidate.

For the full setup path, read:

1. `docs/00-PREREQUISITES.md`
2. `docs/09-QUICKSTART-WINDOWS.md`
3. `docs/08-VERIFY-BEFORE-AUTONOMY.md`
4. `docs/12-THREAT-MODEL.md`
5. `docs/13-PRODUCTION-HARDENING.md`
6. `docs/11-RELEASE-CHECKLIST.md`

## Scope

This repository is a reference implementation and setup pattern, not a security certification. Real-world use requires target-host verification, separate worker identities/processes and bounded adapters for the tools you choose to connect.

## License

Apache-2.0.
