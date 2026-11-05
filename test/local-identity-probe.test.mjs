import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/verify/local-identity-probe.mjs');

test('local same-identity access is not falsely reported as protected host isolation', () => {
  const run = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: { ...process.env }, timeout: 10000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(run.stdout);
  assert.equal(result.schema_version, 'bar.local-identity-probe.v1');
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.same_identity_can_read_synthetic_controller_file, true);
  assert.equal(result.protected_mode_denies_local_generic_worker, true);
  assert.equal(result.effective_separate_identity_tested, false);
  assert.equal(result.docker_isolation_tested, false);
});
