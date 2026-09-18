# BAR Project State

Updated: 2026-09-18
Portfolio push: NO_PUSH
Current outcome: DONE
Product lifecycle: STABLE_MAINTENANCE

## Accepted baseline

- Repository: `steerion-labs/bounded-agent-runtime`
- Branch: `main`
- Final technical baseline: `2e8845f13beb48618b4aa78d2125792064d2e47b`
- Final promotion set accepted through explicit Human Gate: PRs #45, #46, #58, #59 and #64.
- Final exact-head independent review for PR #58: NVIDIA Nemotron 3 Super 120B `PASS / FINDINGS NONE`.
- Final `main` regression: 163/163 PASS, 0 FAIL.
- Final `git diff --check`: PASS.
- Final repository queue at closure: 0 open PRs, 0 open Issues.
## Portfolio rule

BAR is no longer an active engineering push lane. Treat it as maintenance-only unless a new concrete security/product blocker is proven or Vebi explicitly reactivates it.

Roadmap ideas, dependency refreshes, documentation polish and optional integrations are maintenance/backlog work. They do not keep BAR active in the Vebi Project Control Plane.

## Boundaries

BAR remains the authority/evidence boundary around coding agents. No automatic merge, deploy, release, credential expansion, productive action or model-owned protected authority is implied by DONE/NO_PUSH.

Evidence first. Human Gate remains required for protected decisions.
