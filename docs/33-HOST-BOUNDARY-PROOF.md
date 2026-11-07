# BAR v0.6 — Linux and container boundary proof

These are repeatable synthetic tests, not an independent security certification.

## Run

Linux with authorised root privileges, no new OS accounts or real keys:
    sudo bash scripts/verify/linux-effective-access.sh

Docker with official node:20-alpine image cached locally:
    npm run test:container

Linux probe creates a temporary synthetic controller canary and uses
setpriv to test a worker with UID 65534. Must deny read/write,
symlink/hardlink escape, allow worker-local writes, then clean up.

Docker test runs BAR's real container Builder/Reviewer E2E and a
separate, stricter hardened reference-container test. The separate
reference uses non-root UID, cap-drop ALL, no-new-privileges, read-only
root filesystem, no network routes and no inherited common key env.
These extra flags are NOT all implemented by BAR's real adapter.
Do not infer production BAR isolation from the reference alone.

## Linux evidence on 2026-11-07

Netcup Linux, Desktop Commander UID 0, Docker 29.8.1, Node 22.23.3,
source b0c1f0e291e78b6af3e2d91e6abcaa5defa542f6 before this patch.
Synthetic two-principal denial test PASS; original real BAR container
E2E 2/2 PASS; stricter reference-container negative 1/1 PASS.
No production services or secrets used; no leftover BAR containers.
Pinned node image:
node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

These checks must be rerun at final candidate HEAD.

## Outstanding #86 and #87

- Real isolated LLM agent adversarial benchmark using synthetic canaries.
- Windows effective-identity and ACL / reparse boundary test.
- Actual BAR protected deployment with separated controller keys and
  worker identity plus controlled protected side-effect adapters.
- Independent security review, exact-head CodeQL and CI verification.

No local/synthetic PASS should upgrade those requirements to PASS.
