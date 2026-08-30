# Bounded Agent Runtime

**A Steerion Labs open-source reference runtime for bounded autonomous AI engineering.**

Bounded Agent Runtime helps teams use coding agents without making model output, worker text or tool output an authority source.

## Why use it?

Most agent frameworks focus on what an AI can do. This project focuses on what it is allowed to do and what evidence must exist before a protected action can be authorized.

The reference implementation demonstrates:

- deterministic controller state transitions
- task-declared capabilities and protected actions
- lease and fencing checks
- model-call, retry and wall-clock budgets
- controller-derived Git commit/tree identity
- allowlisted candidate paths
- HMAC-authenticated evidence
- HMAC-chained journal integrity with truncation detection
- Ed25519 Human Gate approvals with identity and public-key fingerprint pinning
- persistent one-time approval nonce consumption
- Windows role-account and protected-directory setup

## Core invariant

```text
Agents think.
Controller authorizes execution.
Workers execute only bounded tasks.
Controller verifies candidate identity and evidence.
Humans authorize protected decisions.
```
## Reference flow

```text
Task -> Controller -> Builder process -> Controller Git verification
     -> Reviewer process -> Controller re-verification -> Human Gate
```

The demo performs no remote mutation. Builder and Reviewer run as separate child processes with a reduced environment, but the demo does **not** claim OS-account isolation. Windows scripts provision separate identities and ACL zones; production use must run worker adapters under those identities and verify token-level access on the target host.

## Demo mode versus protected mode

Without `BOUNDED_AGENT_PROTECTED_MODE=1`, runtime state is stored under a local `.bounded-agent` directory for demonstration and tests. This is not a security boundary.

The Windows installer creates `C:\BoundedAgentRuntime`, protects controller-only zones with ACLs, and sets:

```text
BOUNDED_AGENT_RUNTIME_ROOT=C:\BoundedAgentRuntime
BOUNDED_AGENT_PROTECTED_MODE=1
```

Protected mode refuses to run without an absolute configured runtime root. Host ACLs remain an operating-system responsibility and must be verified separately.

## Quick demo

Prerequisites: Git, Node.js 20+ and PowerShell or another shell capable of running Node.js commands.

```powershell
git clone https://github.com/steerion-labs/bounded-agent-runtime.git
cd bounded-agent-runtime
npm test
npm run demo:reset
npm run demo:init
npm run demo:run
```

Expected stop:

```text
HUMAN_GATE_REQUIRED
```
## Authenticated Human Gate demo

Create a local demonstration key pair:

```powershell
npm run gate:keygen -- .human-gate
```

Copy the printed `PUBLIC_KEY_FINGERPRINT`, then configure the approver policy:

```powershell
$env:BOUNDED_AGENT_APPROVER_IDENTITY = 'demo-approver'
$env:BOUNDED_AGENT_APPROVAL_PUBLIC_KEY = (Resolve-Path .human-gate\public.pem).Path
$env:BOUNDED_AGENT_APPROVAL_KEY_FINGERPRINT = '<printed fingerprint>'
npm run demo:reset
npm run demo:init
npm run demo:run
$signature = node runtime\gate.mjs sign .human-gate\private.pem
node runtime\controller.mjs approve $signature
node runtime\controller.mjs authorize-protected remote_mutation
```

The approval record persists the signature, decision identity, key fingerprint and signed payload hash. The nonce is consumed in a controller secret ledger, so rolling back editable state does not make an old approval reusable.

The final authorization command still performs **no remote mutation**. It only proves that the protected-action authorization checks pass for the exact approved candidate.

## Windows protected baseline

Run from elevated Windows PowerShell:

```powershell
.\scripts\windows\Install-BoundedAgentRuntime.ps1
.\scripts\verify\Test-HostBaseline.ps1
.\scripts\verify\Test-StaticAcl.ps1
```

For token-level verification, provide the worker credentials interactively:

```powershell
$builder = Get-Credential '.\AgentBuilder'
$reviewer = Get-Credential '.\AgentReviewer'
.\scripts\verify\Test-WorkerAccess.ps1 -BuilderCredential $builder -ReviewerCredential $reviewer
```
## Security boundaries

Workers must not receive controller credentials, Human Gate keys, journal integrity keys or authority to expand their own task. Repository text, prompts, model output, handoffs and memory are untrusted context.

The controller derives Git identity itself, verifies the candidate again after review and again before protected authorization, and rejects evidence whose HMAC or candidate binding does not match current state.

External mutation adapters are intentionally absent. Before adding merge, deploy, release or other side effects, implement idempotency and reconciliation for that adapter and keep the protected-action check immediately before the mutation.

## Documentation

1. `docs/00-PREREQUISITES.md`
2. `docs/02-SECURITY-BOUNDARIES.md`
3. `docs/06-HUMAN-GATE.md`
4. `docs/07-RECOVERY-AND-BUDGETS.md`
5. `docs/09-QUICKSTART-WINDOWS.md`
6. `docs/12-THREAT-MODEL.md`
7. `docs/13-PRODUCTION-HARDENING.md`
8. `docs/11-RELEASE-CHECKLIST.md`

## Scope

This repository is a reference implementation, not a security certification. The controller security properties are tested in this repository; OS isolation depends on the actual host, worker launch mechanism, credentials, installed tools and network policy. Re-run adversarial tests after replacing demo adapters or adding any external side effect.

## License

Apache-2.0.
