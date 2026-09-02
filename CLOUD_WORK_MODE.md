# Bounded Agent Runtime Cloud-First Work Mode

## Purpose
BAR must be developable, reviewable and testable from GitHub and a cloud development workspace without requiring the owner's Windows PC to be online.

## Source of truth
Accepted GitHub `main`, repository governance, tests and canonical evidence are authoritative. Local machine state is optional compatibility context only.

## Default execution path
GitHub -> bounded cloud workspace -> branch -> targeted tests/security checks -> pull request -> independent review -> Human Gate where required.

Cloud work mode does not grant new runtime authority, secrets access, productive connectors, auto-merge, release, deployment or Human Accept.

## Reproducibility requirements
A fresh checkout must document or contain dependency installation, runtime configuration, test commands and security validation. Secrets must never be committed. Canonical instructions use repository-relative paths. Windows-specific checks remain supported as explicit compatibility gates, not prerequisites for normal engineering work.

## Public-repository constraint
This repository is public. Never place private project context, credentials, internal infrastructure details, customer/business data or machine-specific secrets in issues, commits, branches, workflow logs or documentation.

## Agent startup contract
Resolve live revision, governance, capability boundaries, current task and required checks from repository state before mutation. Missing authority or security-critical context fails closed.

## Cost control
Routine checks should run in the cloud development workspace. Existing manual-only release/container workflows remain manual. Do not add automatic workflow triggers merely to support PC-independent development.

## PC-independent done condition
Implementation, review preparation and all non-host-specific validation can be completed from a clean cloud checkout. Any Windows/device-specific verification is separate, explicit compatibility evidence.
