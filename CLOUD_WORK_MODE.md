# Bounded Agent Runtime Cloud-First Work Mode

## Purpose
BAR must be developable, reviewable and testable from GitHub and a cloud development workspace without requiring the owner's Windows PC to be online.

## Source of truth
Accepted GitHub `main`, repository governance, tests and canonical evidence are authoritative. Local machine state is optional compatibility context only.

## Default execution path
GitHub -> bounded cloud workspace -> branch -> targeted tests/security checks -> pull request -> independent review -> Human Gate where required.

Cloud work mode does not grant new runtime authority, secrets access, productive connectors, auto-merge, release, deployment or Human Accept.

## Reproducibility requirements
A fresh checkout must contain or document dependency installation, runtime configuration, test commands and security validation. Secrets must never be committed. Canonical instructions use repository-relative paths. Windows-specific checks remain supported as explicit compatibility gates, not prerequisites for normal engineering work.

The reference cloud workspace pins Node 22 and provisions Docker-in-Docker. Dependency installation is deterministic through `npm ci`. The canonical proof command is:

```bash
bash scripts/cloud-parity-proof.sh
```

## BAR cloud parity gate
`BAR_CLOUD_ENGINEERING_PASS` requires all of the following on a fresh cloud checkout:

1. Node >=20, npm, Git and a working Docker daemon are available without local-PC state.
2. `npm ci` succeeds without manual dependency repair.
3. `npm test` succeeds.
4. `npm run test:container` succeeds using the pinned `node:20-alpine` container dependency.
5. The exact tested commit SHA is recorded with the proof result.
6. No secret, private project context, customer/business data or machine-specific credential is required.
7. A branch change, commit and pull request can be produced from the cloud workspace.

A successful cloud gate proves PC-independent engineering for non-host-specific BAR work. It does **not** prove Windows security parity.

## Windows compatibility gate
Windows ACL, Windows role-account behavior, Named Pipes, Windows credential-store behavior and other host-specific security properties remain separate evidence under `BAR_WINDOWS_COMPATIBILITY_PASS`. Linux/cloud evidence must never be presented as proof of those properties.

## Public-repository constraint
This repository is public. Never place private project context, credentials, internal infrastructure details, customer/business data or machine-specific secrets in issues, commits, branches, workflow logs or documentation.

## Agent startup contract
Resolve live revision, governance, capability boundaries, current task and required checks from repository state before mutation. Missing authority or security-critical context fails closed.

## Runtime security
Treat `.devcontainer/`, Dockerfiles, bootstrap/proof scripts and dependency manifests as code-execution and supply-chain surfaces. Cloud workspaces must use minimum necessary credentials and must not receive production secrets merely because they are available to the repository owner.

## Cost control
Routine checks should run in the cloud development workspace. Existing manual-only release/container workflows remain manual. Do not add automatic workflow triggers or prebuilds merely to support PC-independent development. Record actual runtime and billed usage during the proof before choosing Codespaces or a persistent cloud VM for steady-state work.

## PC-independent done condition
Implementation, review preparation and all non-host-specific validation can be completed from a clean cloud checkout. Any Windows/device-specific verification is separate, explicit compatibility evidence.
