# GitHub-First Cloud Mode

Status: REFERENCE PILOT
Target branch: `main`
Canonical remote: GitHub

BAR is the reference project for proving that normal engineering can continue with the user's PC powered off.

## Standard path

`GitHub -> Codespaces/devcontainer -> npm ci -> npm test -> npm run test:container -> npm run quickstart -> PR -> CI -> review -> Human Accept -> merge`

## Cloud rules

- fresh checkout is authoritative for reproducibility
- no dependency on Desktop Commander or local Windows paths for the normal path
- no secrets required for baseline tests/quickstart
- local agent adapters may be optional, but the deterministic runtime/test path must remain cloud-runnable
- Actions, CodeQL and Dependabot provide remote evidence independent of the user's PC
- GitHub Actions are enabled for the repository during the cloud-readiness proof

## Success condition

With the user's PC off, a browser-only Codespace can install, test, run the container E2E and reach the expected `HUMAN_GATE_REQUIRED` quickstart stop.

## Authority

Cloud execution does not grant merge, deploy, release or protected-action authority. BAR's Human Gate and repository review rules remain authoritative.
