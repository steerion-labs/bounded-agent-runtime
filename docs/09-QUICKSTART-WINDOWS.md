# Windows Quickstart

## 1. Prerequisites

Use Windows 11 Pro or Enterprise, PowerShell 5.1+ or PowerShell 7, Git and Node.js 20+. Start on a non-production machine or disposable test environment.

## 2. Verify the repository

```powershell
npm test
npm run demo:reset
npm run demo:init
npm run demo:run
```

The demo must stop at `HUMAN_GATE_REQUIRED` and must not perform a remote mutation.

## 3. Create the protected Windows baseline

Open an elevated PowerShell:

```powershell
.\scripts\windows\Install-BoundedAgentRuntime.ps1
```

The account script prompts securely for passwords only when a role account does not already exist. Passwords are not printed or written by the installer.

The installer creates `C:\BoundedAgentRuntime`, hardens its ACL zones and sets the machine environment variables used by protected mode.
## 4. Run static ACL verification

```powershell
.\scripts\verify\Test-HostBaseline.ps1
.\scripts\verify\Test-StaticAcl.ps1
```

These checks verify account presence, non-admin workers, protected ACL inheritance and expected/forbidden SID grants. They do not claim token-level effective access.

## 5. Prove worker access using real Windows tokens

```powershell
$builder = Get-Credential '.\AgentBuilder'
$reviewer = Get-Credential '.\AgentReviewer'
.\scripts\verify\Test-WorkerAccess.ps1 -BuilderCredential $builder -ReviewerCredential $reviewer
```

The worker-access probe must show that Builder and Reviewer cannot read controller secrets, each worker can write its own workspace, and Reviewer cannot write Builder's workspace.

## 6. Attach tools carefully

Run real Builder and Reviewer adapters under separate worker identities. Do not copy controller, GitHub, cloud, Human Gate or deployment credentials into worker profiles or environments.

## 7. Keep external mutation gated

The repository intentionally contains no real merge/deploy/release adapter. Before adding one, implement idempotency and reconciliation and call the protected-action authorization immediately before the side effect.

Re-run the adversarial test suite after every change to runtime core, policy, identity, credentials or mutation capability.
