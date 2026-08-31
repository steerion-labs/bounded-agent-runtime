# Docker Container Isolation Adapter

The Docker adapter is an optional execution boundary. BAR remains the authority controller; Docker supplies disposable process/filesystem/network isolation.

## Task creation

The image must exist locally. `bar task` resolves a tag to its immutable repository digest before writing the task:

```powershell
docker pull node:20-alpine
bar task --repo C:\repo --intent "Change src/value.txt" `
  --allow src `
  --builder container `
  --builder-image node:20-alpine `
  --builder-command node `
  --builder-arg /agent/run.js
```

BAR stores `image@sha256:<digest>` in the task. Mutable tag-only container tasks fail validation.

## Container defaults

The adapter creates a disposable container with:

- `--network none`
- `--cap-drop ALL`
- `no-new-privileges`
- no Docker socket mount
- no host `.git` directory
- PID limit
- configurable memory/CPU limits
- bounded `/tmp`

BAR seeds the container with a working-tree copy rather than a host bind mount. This avoids exposing controller Git metadata and works even when Docker Desktop does not permit Windows host bind mounts.

## Builder return path

After a successful Builder exit, BAR copies the disposable container workspace to a temporary host directory and copies back **only task-allowlisted paths**. The normal controller path/symlink/hardlink checks still run before candidate commit.

Anything outside the allowlist is discarded.

## Reviewer return path

Reviewer containers receive an exact candidate working-tree copy, but BAR copies **nothing** back from the Reviewer container. Reviewer filesystem mutations therefore cannot propagate into the host candidate.

Reviewer prose is still untrusted. Approval requires commit/tree binding and the normal controller Evidence/Human Gate path.

## What this does not prove

- Docker daemon compromise is outside this adapter's boundary.
- A malicious pre-existing image can execute arbitrary code inside its container boundary.
- `network none` intentionally prevents network-dependent coding agents unless a separately designed bounded network path is introduced.
- Host hardening and Docker daemon security still matter.

The repository includes a real Docker E2E suite (`npm run test:container`) that verifies the Builder flow and non-propagating Reviewer mutations.
