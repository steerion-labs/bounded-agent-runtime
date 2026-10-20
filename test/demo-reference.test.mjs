import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = path.join(here, '..', 'scripts', 'demo-reference.mjs');

test('disposable Git work is verified, reviewed and stops before protected actions', () => {
  const run = spawnSync(process.execPath, [demo], {
    encoding: 'utf8', env: { ...process.env }, timeout: 60000
  });
  assert.equal(run.status, 0, run.stderr || run.error?.message || run.stdout);
  assert.match(run.stdout, /1\/1 BOUNDED WORKFLOW VERIFIED/);
  assert.match(run.stdout, /2\/2 ESCALATIONS BLOCKED/);
  assert.match(run.stdout, /HUMAN_GATE_REQUIRED/);
  assert.match(run.stdout, /source unchanged/);
  assert.match(run.stdout, /separate reviewer workspace/);
});
