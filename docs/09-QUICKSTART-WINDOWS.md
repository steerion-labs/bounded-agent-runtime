# Windows Quickstart

## 1. Prerequisites

Use Windows 11 with PowerShell 5.1+ or PowerShell 7, Git and Node.js 20+. Start on a non-production machine or disposable test environment.

## 2. Verify the repository

```powershell
npm test
npm run demo:reset
npm run demo:init
npm run demo:run
```

The demo must stop at `HUMAN_GATE_REQUIRED`. It must not perform a remote mutation.

## 3. Create the Windows baseline

Open an elevated PowerShell:

```powershell
.\scripts\windows\Install-BoundedAgentRuntime.ps1
```

This creates generic local role identities and the protected directory layout under `C:\BoundedAgentRuntime`.

## 4. Verify the baseline

```powershell
.\scripts\verify\Test-HostBaseline.ps1
.\scripts\verify\Test-EffectiveAccess.ps1
```

## 5. Attach tools carefully

Install your chosen coding/model tools separately. Run Builder and Reviewer with separate worker identities. Do not copy controller, GitHub, cloud or deployment credentials into worker profiles or environment variables.

## 6. Prove effective isolation

The baseline and static effective-access verifiers check expected users, non-admin worker status, protected zones, ACL inheritance and expected/forbidden worker grants. It is not a substitute for effective-access testing.

Before real autonomy, prove on the target host that Builder and Reviewer cannot read or write controller-only zones, cannot inherit higher privilege through tool fallback, and cannot reuse stale leases or evidence.

## 7. Start with local-only tasks

Keep merge, deploy, release, permission changes, secret changes and any remote mutation behind an authenticated Human Gate. Expand capabilities only after negative tests pass.
