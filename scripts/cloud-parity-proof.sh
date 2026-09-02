#!/usr/bin/env bash
set -euo pipefail

printf 'BAR cloud parity proof\n'
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

printf 'BAR_CLOUD_ENGINEERING_PASS candidate checks completed successfully.\n'
