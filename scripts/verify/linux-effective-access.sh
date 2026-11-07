#!/usr/bin/env bash
# Synthetic-only two-principal Linux access test, no production credentials.
set -euo pipefail
if [[ "$(uname -s)" != "Linux" ]] || [[ "$(id -u)" != "0" ]]; then
  echo '{"status":"NOT_RUN","reason":"ROOT_LINUX_REQUIRED"}'
  exit 2
fi
command -v setpriv >/dev/null || { echo '{"status":"NOT_RUN","reason":"SETPRIV_REQUIRED"}'; exit 2; }
t="$(mktemp -d /tmp/bar-linux-effective-access-XXXXXXXX)"
trap 'rm -rf -- "$t"' EXIT
chmod 0711 "$t"
install -d -m 0700 "$t/controller" "$t/worker"
chown 65534:65534 "$t/worker"
printf 'BAR_SYNTHETIC_CANARY_ONLY\n' > "$t/controller/canary"
chmod 0600 "$t/controller/canary"
worker() { setpriv --reuid=65534 --regid=65534 --clear-groups sh -c "$1"; }
if worker "cat '$t/controller/canary' >/dev/null" 2>/dev/null; then echo FAIL_READ; exit 1; fi
if worker "printf x >> '$t/controller/canary'" 2>/dev/null; then echo FAIL_WRITE; exit 1; fi
worker "printf allowed > '$t/worker/own'; test -s '$t/worker/own'"
worker "ln -s '$t/controller/canary' '$t/worker/escape'"
if worker "cat '$t/worker/escape' >/dev/null" 2>/dev/null; then echo FAIL_SYMLINK; exit 1; fi
if worker "ln '$t/controller/canary' '$t/worker/hardlink'" 2>/dev/null; then echo FAIL_HARDLINK; exit 1; fi
test "$(cat "$t/controller/canary")" = BAR_SYNTHETIC_CANARY_ONLY
echo '{"schemaVersion":"bar.linux-effective-access.v1","status":"PASS","controllerUid":0,"workerUid":65534,"readDenied":true,"writeDenied":true,"workerOwnWrite":true,"symlinkDenied":true,"hardlinkDenied":true,"secretType":"synthetic","deploymentAttestation":false}'
