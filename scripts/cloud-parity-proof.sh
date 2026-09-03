#!/usr/bin/env bash
set -euo pipefail

printf 'BAR cloud parity proof\n'

git rev-parse --is-inside-work-tree >/dev/null
candidate_sha="$(git rev-parse --verify HEAD)"
candidate_tree="$(git rev-parse --verify HEAD^{tree})"
branch="$(git symbolic-ref --quiet --short HEAD || printf 'DETACHED')"

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  printf 'BAR_CLOUD_ENGINEERING_FAIL dirty worktree; commit or remove all changes before proof.\n' >&2
  exit 1
fi

if [[ -n "$(git ls-files --unmerged)" ]]; then
  printf 'BAR_CLOUD_ENGINEERING_FAIL unresolved merge state.\n' >&2
  exit 1
fi

git diff --check

printf 'candidate_sha: %s\n' "$candidate_sha"
printf 'candidate_tree: %s\n' "$candidate_tree"
printf 'branch: %s\n' "$branch"
printf 'node: '; node --version
printf 'npm: '; npm --version
printf 'git: '; git --version
printf 'docker: '; docker --version

node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 20) { throw new Error('Node >=20 required'); }"

npm ci

docker info >/dev/null
docker pull node:20-alpine >/dev/null

npm test
npm run test:container

if [[ "$(git rev-parse --verify HEAD)" != "$candidate_sha" ]] || [[ "$(git rev-parse --verify HEAD^{tree})" != "$candidate_tree" ]]; then
  printf 'BAR_CLOUD_ENGINEERING_FAIL candidate changed during proof.\n' >&2
  exit 1
fi

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  printf 'BAR_CLOUD_ENGINEERING_FAIL proof modified the worktree.\n' >&2
  exit 1
fi

printf 'BAR_CLOUD_ENGINEERING_PASS sha=%s tree=%s branch=%s\n' "$candidate_sha" "$candidate_tree" "$branch"
