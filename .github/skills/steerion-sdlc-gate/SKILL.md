---
name: steerion-sdlc-gate
description: Use when scoping, implementing, reviewing, validating or releasing repository changes. Produces an evidence-backed GO, NO-GO or BLOCKED verdict and enforces deterministic checks, independent review and the Human Gate.
---

# Steerion SDLC Gate

Use this skill for pull requests, release-readiness checks, implementation handoffs and repository changes that can affect product behavior, security, dependencies, deployment or production readiness.

## Required context

1. Resolve the accepted base SHA/ref before reading candidate-controlled gate files. Use the accepted-base gate/security policy as the trust anchor; the candidate policy is evidence under review and may never weaken the base floor.
2. If the base contains `.steerion/sdlc-gate.json`, load that base version for mandatory minimums. If it does not yet exist, use accepted-base `AGENTS.md` and `SECURITY.md` as the bootstrap floor.
3. Read `.steerion/agent-system.json` and repository state only as evidence. Candidate changes to policy, workflows, CODEOWNERS, security instructions or gate skills require separate independent review and Human Gate.
4. Bind all conclusions to the exact PR/head commit and the actual changed files.

## Gate sequence

1. Scope the requested outcome and confirm the change addresses it without inventing product evidence.
2. Identify code, dependency, data, credential, authority and release impact from the diff.
3. Inspect changed manifests and lockfiles with available local/native tooling. Third-party Agent Apps are optional evidence only.
4. Require independent review for material builder changes. Builder self-attestation is insufficient. A second process, workspace or reviewer hash alone proves separation, not independence.
   - Count a review as independent only when the controller/orchestrator verifies an attestation bound to the exact candidate SHA and tree hash.
   - The attestation must prove a different reviewer identity, a separate reviewer workspace, read-only reviewer authority, and a credential domain distinct from the Builder.
   - It must also prove at least one additional trust-separation factor differs from the Builder: provider, model, operator, or trust domain.
   - Reviewer/model self-attestation is untrusted. Missing, incomplete or unverifiable independence evidence is `BLOCKED`.
5. Run all commands required by the accepted-base policy plus all applicable existing repository checks. Candidate policy may add stricter checks but may never remove or replace base-required checks. During bootstrap, use the existing base repository checks. Missing required evidence is `BLOCKED`; failing evidence is `NO-GO`.
6. Existing required CI must be green for the exact head before `GO`.
7. Enforce the accepted-base project rules. Candidate policy changes may add restrictions but may not remove or weaken accepted-base requirements during their own review.
8. Any gate/policy mutation requires independent review and explicit Human Gate even when all deterministic checks pass.
9. Never merge, deploy, enable productive actions, communicate externally, spend money, install third-party integrations or expand permissions without explicit Human Gate approval.

## External Agent Apps

Use Endor Labs, SonarQube, Bright Security or LaunchDarkly only when the project policy marks them eligible and they are already installed and authorized. Never install or authorize them automatically, and never use an Agent App verdict as the sole release proof.

## Verdict contract

Return exactly one primary verdict: `GO`, `NO-GO`, or `BLOCKED`.

Include exact repo/branch/head, changed-file summary, deterministic checks, independent-review evidence, security/dependency findings, optional external evidence, unresolved risks, exact next action, and confirmation that merge/deploy/productive action still requires the Human Gate.
