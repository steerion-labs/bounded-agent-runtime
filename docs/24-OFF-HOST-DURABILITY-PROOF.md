# Off-Host Durability Proof

BAR uses GitHub-hosted runners as a zero-secret, read-only proof environment for the authority and recovery path. This is a BAR proof surface, not a hosted control plane and not a deployment system.

## Cadence

- hourly: Ubuntu + Windows core durability proof;
- daily: container isolation E2E;
- pull requests touching BAR runtime/tests/proof policy: all proof jobs;
- manual dispatch: all proof jobs.

The workflow uses repository read permission only. Checkout credentials are not persisted. No repository, issue, release, deployment or external-system write is performed.

## Core proof

Each Linux/Windows proof binds the exact checkout HEAD and proves selected high-value controls:

- expired leases fail closed;
- fencing mismatches fail closed;
- Human Gate is reached on the synthetic end-to-end path;
- a forged accepted state cannot bypass the Human Gate;
- approval nonce replay is rejected;
- a durably journaled transition can recover after simulated state-write failure;
- lease takeover fences a stale controller snapshot;
- fencing-token tampering and candidate drift are rejected after approval;
- BAR quickstart ends at `4/4 PASS: HUMAN_GATE_REQUIRED`;
- the source checkout remains clean.

The machine-readable `bar.durability-proof.v1` evidence and compact log are retained as GitHub Actions artifacts for seven days.

## Container proof

The daily Ubuntu job runs the existing container E2E and emits `bar.container-durability-proof.v1`.

## What this proves

When the workflow is green on `main`, BAR's bounded authority/recovery path is being independently re-executed off the CEO development PC on GitHub-hosted infrastructure.

## What this does not prove

This workflow does not:

- mutate My Company or another private repository;
- authenticate to GitHub Project #2;
- prove My Company's PostgreSQL backup/restore path;
- deploy BAR;
- merge, release or publish anything;
- prove a productive remote side-effect adapter.

Those are separate Company-level durability gates. This proof intentionally requires no secrets and cannot widen BAR authority.
