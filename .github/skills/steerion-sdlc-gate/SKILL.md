---
name: steerion-sdlc-gate
description: Use when scoping, implementing, reviewing, validating or releasing repository changes. Produces an evidence-backed GO, NO-GO or BLOCKED verdict and enforces deterministic checks, independent review and the Human Gate.
---

# Steerion SDLC Gate

Use this skill for pull requests, release-readiness checks, implementation handoffs and repository changes that can affect product behavior, security, dependencies, deployment or production readiness.

## Required context

1. Read `.steerion/sdlc-gate.json` first when present.
2. Read `.steerion/agent-system.json` when present and use its declared checks and authority model.
3. Read the repository instructions and current-state files referenced by the project runtime.
4. Bind all conclusions to the exact PR/head commit and the actual changed files.

## Gate sequence

1. Scope the requested outcome and confirm the change addresses it without inventing product evidence.
2. Identify code, dependency, data, credential, authority and release impact from the diff.
3. Inspect changed manifests and lockfiles with available local/native tooling. Third-party Agent Apps are optional evidence only.
4. Require independent review for material builder changes. Builder self-attestation is insufficient.
5. Run all commands in `.steerion/sdlc-gate.json` and all applicable existing repository checks. Missing required evidence is `BLOCKED`; failing evidence is `NO-GO`.
6. Existing required CI must be green for the exact head before `GO`.
7. Enforce all project-specific rules in `.steerion/sdlc-gate.json`.
8. Never merge, deploy, enable productive actions, communicate externally, spend money, install third-party integrations or expand permissions without explicit Human Gate approval.

## External Agent Apps

Use Endor Labs, SonarQube, Bright Security or LaunchDarkly only when the project policy marks them eligible and they are already installed and authorized. Never install or authorize them automatically, and never use an Agent App verdict as the sole release proof.

## Verdict contract

Return exactly one primary verdict: `GO`, `NO-GO`, or `BLOCKED`.

Include exact repo/branch/head, changed-file summary, deterministic checks, independent-review evidence, security/dependency findings, optional external evidence, unresolved risks, exact next action, and confirmation that merge/deploy/productive action still requires the Human Gate.
