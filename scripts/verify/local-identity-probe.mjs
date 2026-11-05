import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertWorkerExecutionBoundary } from '../../runtime/core.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-local-identity-check-'));
try {
  const canary = path.join(dir, 'controller-canary.txt');
  fs.writeFileSync(canary, 'BAR_TEST_CANARY_NOT_A_REAL_SECRET', { mode: 0o600 });
  const child = spawnSync(process.execPath, ['-e',
    "require('fs').readFileSync(process.argv[1], 'utf8'); process.stdout.write('SAME_IDENTITY_READ_OK')",
    canary], {
      encoding: 'utf8', cwd: dir, windowsHide: true, timeout: 5000,
      env: { PATH: process.env.PATH || '', Path: process.env.Path || '',
        SystemRoot: process.env.SystemRoot || '', WINDIR: process.env.WINDIR || '' }
    });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  assert.equal(child.stdout, 'SAME_IDENTITY_READ_OK');
  let denied = false;
  try { assertWorkerExecutionBoundary('generic', 'builder', true); }
  catch (error) { denied = /PROTECTED_MODE_REQUIRES_ISOLATED_WORKER/.test(String(error.message)); }
  assert.equal(denied, true);
  process.stdout.write(JSON.stringify({
    schema_version: 'bar.local-identity-probe.v1',
    status: 'PARTIAL',
    os: process.platform,
    same_identity_can_read_synthetic_controller_file: true,
    protected_mode_denies_local_generic_worker: denied,
    effective_separate_identity_tested: false,
    docker_isolation_tested: false,
    scope: 'Synthetic canary only; local same-identity subprocess is not an OS sandbox',
    required_followup: 'Real separate-principal and container denial proof on a named host; Windows separately'
  }) + '\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
